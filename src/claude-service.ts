import { spawn } from "child_process";
import type { Logger } from "./logger";
import type { ClaudeCallOptions, ClaudeJsonMessage, ClaudeResponse } from "./types";

// ---------------------------------------------------------------------------
// Named constants (no magic numbers)
// ---------------------------------------------------------------------------

/** How many chars of raw stdout to log in debug mode. */
const STDOUT_PREVIEW_LENGTH = 500;

/** How many chars of extracted text to log. */
const TEXT_PREVIEW_LENGTH = 200;

/**
 * QUIRK: `--json-schema` makes Claude call an internal StructuredOutput tool.
 * That tool call counts as turn 1, and the tool result is turn 2 — so we need
 * at least 2 turns for any schema-based call to complete.
 */
const MIN_TURNS_WITH_SCHEMA = 2;

/** Without a schema the prompt→response is a single turn. */
const DEFAULT_TURNS = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Spawns the Claude CLI and returns a parsed response.
 *
 * Uses `claude -p` with `--output-format json` which returns a
 * single JSON array of message objects once the call completes.
 * We extract the session_id from the system init message and
 * the result text from the final result message.
 */
export async function callClaude(
	options: ClaudeCallOptions,
	logger?: Logger,
	cliPath?: string,
): Promise<ClaudeResponse> {
	const args = buildArgs(options);
	const bin = cliPath || "claude";

	logger?.info("service", `Spawning: ${bin}`, args);

	return new Promise((resolve, reject) => {
		const proc = spawn(bin, args, {
			env: { ...process.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		// QUIRK: stdin must close immediately or the CLI hangs forever waiting
		// for interactive input. We're using `-p` (prompt mode), not interactive.
		proc.stdin.end();

		logger?.info("service", `Process spawned — PID: ${proc.pid}`);

		proc.stdout.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stdout += text;
			logger?.info("service", `stdout chunk (${text.length} chars, total: ${stdout.length})`);
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stderr += text;
			logger?.info("service", `stderr chunk: ${text.trim()}`);
		});

		proc.on("error", (err) => {
			logger?.error("service", "Failed to spawn claude CLI:", err.message);
			reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
		});

		proc.on("close", (code, signal) => {
			logger?.info(
				"service",
				`Process closed — code: ${code}, signal: ${signal}, stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`,
			);

			if (stderr) {
				logger?.warn("service", "stderr:", stderr.trim());
			}

			if (code !== 0) {
				logger?.error("service", `CLI exited with code ${code}`, stderr.trim());
				reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim()}`));
				return;
			}

			logger?.debug("service", "Raw stdout (first chars):", stdout.slice(0, STDOUT_PREVIEW_LENGTH));

			try {
				const response = parseResponse(stdout, logger);
				logger?.info(
					"service",
					`Parsed response — sessionId: ${response.sessionId}, text length: ${response.text.length}, messages: ${response.raw.length}`,
				);
				resolve(response);
			} catch (err) {
				logger?.error("service", "Failed to parse response:", err);
				reject(err);
			}
		});
	});
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildArgs(options: ClaudeCallOptions): string[] {
	const args = ["-p", options.prompt, "--output-format", "json"];

	if (options.model) {
		args.push("--model", options.model);
	}

	if (options.sessionId) {
		args.push("-r", options.sessionId);
	}

	if (options.systemPrompt) {
		args.push("--system-prompt", options.systemPrompt);
	}

	if (options.jsonSchema) {
		args.push("--json-schema", JSON.stringify(options.jsonSchema));
	}

	if (options.maxTokens) {
		// QUIRK: --max-turns 1 is too few when using --json-schema because
		// the StructuredOutput tool call consumes turn 1, and the tool result
		// needs turn 2. Without a schema, a single turn suffices.
		const turns = options.jsonSchema ? MIN_TURNS_WITH_SCHEMA : DEFAULT_TURNS;
		args.push("--max-turns", String(turns));
	}

	return args;
}

/**
 * Parse JSON array output from Claude CLI.
 * `--output-format json` returns a single JSON array of message objects.
 */
function parseResponse(raw: string, logger?: Logger): ClaudeResponse {
	let messages: ClaudeJsonMessage[];

	try {
		const parsed = JSON.parse(raw);
		messages = Array.isArray(parsed) ? parsed : [parsed];
	} catch {
		throw new Error("Failed to parse Claude CLI JSON output");
	}

	if (messages.length === 0) {
		throw new Error("Empty JSON array from Claude CLI output");
	}

	logger?.info(
		"service",
		`Parsed ${messages.length} message(s) — types: ${messages.map((m) => m.type).join(", ")}`,
	);

	for (const msg of messages) {
		logger?.info("service", `Message [${msg.type}]:`, msg);
	}

	const systemMsg = messages.find((m) => m.type === "system" && m.session_id);
	const sessionId = systemMsg?.session_id ?? null;

	// Extraction priority (order matters!):
	// 1. StructuredOutput tool_use block — present when --json-schema is used
	// 2. result.result — plain text summary on the final "result" message
	// 3. Assistant content blocks — last-resort fallback
	const resultMsg = [...messages].reverse().find((m) => m.type === "result");
	const text =
		extractStructuredOutput(messages, logger) ||
		resultMsg?.result ||
		extractTextFromContent(messages);

	logger?.info(
		"service",
		`Extracted text (${text.length} chars): ${text.slice(0, TEXT_PREVIEW_LENGTH)}`,
	);

	return { sessionId, text, raw: messages };
}

/**
 * Extract the JSON payload from a StructuredOutput tool_use block.
 *
 * QUIRK: When `--json-schema` is used, Claude calls an internal tool named
 * "StructuredOutput". The validated object is at `content[].input` where
 * `block.name === "StructuredOutput"` — it is NOT in `result.result`.
 */
function extractStructuredOutput(messages: ClaudeJsonMessage[], logger?: Logger): string | null {
	for (const msg of messages) {
		if (msg.type !== "assistant") continue;
		if (!msg.message?.content) {
			logger?.info("service", "Assistant message has no content array");
			continue;
		}
		logger?.info(
			"service",
			`Assistant content blocks: ${msg.message.content.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", ")}`,
		);
		for (const block of msg.message.content) {
			if (block.type === "tool_use" && block.name === "StructuredOutput" && block.input) {
				const json = JSON.stringify(block.input);
				logger?.info(
					"service",
					`StructuredOutput found (${json.length} chars): ${json.slice(0, TEXT_PREVIEW_LENGTH)}`,
				);
				return json;
			}
		}
	}
	logger?.warn("service", "No StructuredOutput block found in assistant messages");
	return null;
}

/** Fallback: extract text from assistant content blocks. */
function extractTextFromContent(messages: ClaudeJsonMessage[]): string {
	const assistantMessages = messages.filter((m) => m.type === "assistant" && m.message?.content);

	const textBlocks: string[] = [];
	for (const msg of assistantMessages) {
		if (!msg.message?.content) continue;
		for (const block of msg.message.content) {
			if (block.type === "text" && block.text) {
				textBlocks.push(block.text);
			}
		}
	}

	return textBlocks.join("\n") || "(No text in response)";
}
