import { z } from "zod";

export interface ClaudeBridgeSettings {
	debugMode: boolean;
	cliPath: string;
	systemPrompt: string;
	model: string;
	maxBudgetTokens: number;
}

export const DEFAULT_SETTINGS: ClaudeBridgeSettings = {
	debugMode: true,
	cliPath: "",
	systemPrompt:
		"You are a helpful assistant working inside an Obsidian vault. Respond in clean Markdown.",
	model: "sonnet",
	maxBudgetTokens: 50000,
};

/** A content block inside an assistant message */
export interface ContentBlock {
	type: string;
	text?: string;
	/** Present on tool_use blocks (e.g. StructuredOutput) */
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
}

/** The full API message object nested inside assistant/user wrapper messages */
export interface ApiMessage {
	role: string;
	content: ContentBlock[];
	model?: string;
	usage?: Record<string, unknown>;
	[key: string]: unknown;
}

/** Shape of a single message in Claude CLI's --output-format json array */
export interface ClaudeJsonMessage {
	type: "system" | "assistant" | "user" | "result";
	subtype?: string;
	session_id?: string;
	/** The full API message (present on assistant/user messages) */
	message?: ApiMessage;
	/** Result text (present on result messages for plain text responses) */
	result?: string;
	/** Cost/usage metadata on result messages */
	total_cost_usd?: number;
	duration_ms?: number;
	num_turns?: number;
	[key: string]: unknown;
}

/** Resolved result after parsing the full JSON response */
export interface ClaudeResponse {
	sessionId: string | null;
	text: string;
	raw: ClaudeJsonMessage[];
}

/** Options passed to the Claude CLI service */
export interface ClaudeCallOptions {
	prompt: string;
	model?: string;
	sessionId?: string;
	systemPrompt?: string;
	jsonSchema?: Record<string, unknown>;
	maxTokens?: number;
}

/** Context handed to a command's execute method */
export interface CommandContext {
	selection: string;
	fullContent: string;
	filePath: string;
	cursorOffset: number;
}

/** What a command returns after running */
export interface CommandResult<T = string> {
	output: T;
	sessionId: string | null;
}

/** Zod-based command schema definition */
export interface CommandSchema<T> {
	zodSchema: z.ZodType<T>;
	jsonSchema: Record<string, unknown>;
}
