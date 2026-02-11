/**
 * @module types
 *
 * Start here when reading the plugin. This file defines every interface and
 * default value used across the codebase — it's the single source of truth
 * for the shapes flowing between the CLI service, commands, and Obsidian UI.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ClaudeBridgeSettings {
	debugMode: boolean;
	cliPath: string;
	systemPrompt: string;
	model: string;
	maxBudgetTokens: number;
}

/** Sensible starting point — debug on, auto-detect CLI, sonnet model. */
export const DEFAULT_SETTINGS: ClaudeBridgeSettings = {
	debugMode: true,
	cliPath: "",
	systemPrompt:
		"You are a helpful assistant working inside an Obsidian vault. Respond in clean Markdown.",
	model: "sonnet",
	maxBudgetTokens: 50_000,
};

// ---------------------------------------------------------------------------
// Claude CLI JSON response types
// ---------------------------------------------------------------------------

/** Usage/cost metadata returned on result messages. */
export interface UsageInfo {
	input_tokens?: number;
	output_tokens?: number;
	[key: string]: unknown;
}

/** A content block inside an assistant message. */
export interface ContentBlock {
	type: "text" | "tool_use" | "tool_result" | string;
	text?: string;
	/** Present on tool_use blocks (e.g. StructuredOutput). */
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
}

/** The full API message object nested inside assistant/user wrapper messages. */
export interface ApiMessage {
	role: "assistant" | "user" | "system";
	content: ContentBlock[];
	model?: string;
	usage?: UsageInfo;
	[key: string]: unknown;
}

/** Shape of a single message in Claude CLI's `--output-format json` array. */
export interface ClaudeJsonMessage {
	type: "system" | "assistant" | "user" | "result";
	subtype?: string;
	session_id?: string;
	/** The full API message (present on assistant/user messages). */
	message?: ApiMessage;
	/** Result text (present on result messages for plain text responses). */
	result?: string;
	/** Cost/usage metadata on result messages. */
	total_cost_usd?: number;
	duration_ms?: number;
	num_turns?: number;
	[key: string]: unknown;
}

/** Resolved result after parsing the full JSON response. */
export interface ClaudeResponse {
	sessionId: string | null;
	text: string;
	raw: ClaudeJsonMessage[];
}

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

/** Reusable alias for arbitrary JSON Schema objects passed to the CLI. */
export type JsonSchema = Record<string, unknown>;

/** Options passed to the Claude CLI service. */
export interface ClaudeCallOptions {
	prompt: string;
	model?: string;
	sessionId?: string;
	systemPrompt?: string;
	jsonSchema?: JsonSchema;
	maxTokens?: number;
}

/** Context handed to a command's execute method. */
export interface CommandContext {
	selection: string;
	fullContent: string;
	filePath: string;
	cursorOffset: number;
}

/** What a command returns after running. */
export interface CommandResult<T = string> {
	output: T;
	sessionId: string | null;
}

/** Zod-based command schema definition. */
export interface CommandSchema<T> {
	zodSchema: z.ZodType<T>;
	jsonSchema: JsonSchema;
}
