import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import { callClaude } from "../claude-service";
import { SessionManager } from "../session-manager";
import type { Logger } from "../logger";
import type {
	ClaudeBridgeSettings,
	ClaudeCallOptions,
	CommandContext,
	CommandResult,
	CommandSchema,
} from "../types";

/**
 * Abstract base command that handles the full lifecycle:
 * 1. Gather context from the editor
 * 2. Build the prompt
 * 3. Call Claude CLI
 * 4. Validate the response (if schema provided)
 * 5. Render the result back into the editor
 * 6. Persist the session ID
 *
 * Subclasses implement: buildPrompt, schema (optional), and render.
 */
export abstract class BaseCommand<T = string> {
	abstract readonly id: string;
	abstract readonly name: string;

	constructor(
		protected sessionManager: SessionManager,
		protected settings: ClaudeBridgeSettings,
		protected logger: Logger,
	) {}

	/** Build the prompt from the current editor context. */
	abstract buildPrompt(context: CommandContext): string;

	/** Optional: provide a Zod + JSON Schema for structured output. */
	getSchema(): CommandSchema<T> | null {
		return null;
	}

	/** Render the result back into the editor. Default: replace selection. */
	render(editor: Editor, result: CommandResult<T>): void {
		const text =
			typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2);
		editor.replaceSelection(text);
	}

	/**
	 * Execute the full command lifecycle.
	 *
	 * Flow: gather context → build prompt → call CLI → validate schema
	 * (if provided) → render into editor → persist session ID.
	 */
	async execute(editor: Editor, view: MarkdownView): Promise<void> {
		const file = view.file;
		if (!file) {
			new Notice("No active file");
			return;
		}

		const context = this.gatherContext(editor, file);

		this.logger.info(
			"command",
			`Starting "${this.id}" — file: ${file.path}, selection: ${context.selection.length} chars`,
		);

		if (!context.selection && this.requiresSelection()) {
			new Notice("Select some text first");
			return;
		}

		const sessionId = this.sessionManager.getSessionId(file);
		const prompt = this.buildPrompt(context);
		const schema = this.getSchema();

		const callOptions: ClaudeCallOptions = {
			prompt,
			model: this.settings.model,
			sessionId: sessionId ?? undefined,
			systemPrompt: this.settings.systemPrompt,
			jsonSchema: schema?.jsonSchema,
			maxTokens: this.settings.maxBudgetTokens,
		};

		this.logger.debug("command", "Call options:", {
			...callOptions,
			prompt: callOptions.prompt.slice(0, 200) + "…",
		});

		new Notice(`Running: ${this.name}...`);

		try {
			const response = await callClaude(
				callOptions,
				this.logger,
				this.settings.cliPath || undefined,
			);

			if (response.sessionId) {
				await this.sessionManager.setSessionId(file, response.sessionId);
			}

			let output: T;
			if (schema) {
				const parsed = JSON.parse(response.text);
				output = schema.zodSchema.parse(parsed);
				this.logger.info(
					"schema",
					"Validation passed",
					typeof output === "object"
						? Object.keys(output as Record<string, unknown>)
						: typeof output,
				);
			} else {
				output = response.text as unknown as T;
			}

			this.render(editor, { output, sessionId: response.sessionId });
			this.logger.info("command", `"${this.id}" complete`);
			new Notice(`${this.name} complete`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			this.logger.error("command", `"${this.id}" failed:`, err);
			new Notice(`Claude Bridge error: ${message}`);
		}
	}

	/** Override to return false if the command works on the full note. */
	protected requiresSelection(): boolean {
		return true;
	}

	private gatherContext(editor: Editor, file: TFile): CommandContext {
		return {
			selection: editor.getSelection(),
			fullContent: editor.getValue(),
			filePath: file.path,
			cursorOffset: editor.posToOffset(editor.getCursor()),
		};
	}
}
