import { Editor } from "obsidian";
import { TextResponseSchema } from "../schemas";
import type { Logger } from "../logger";
import type { ClaudeBridgeSettings, CommandContext, CommandResult, CommandSchema } from "../types";
import { SessionManager } from "../session-manager";
import { BaseCommand } from "./base-command";

/**
 * Example command: "Expand selection with Claude"
 *
 * This is a reference implementation showing the three extension points
 * every command must (or may) provide:
 *
 * 1. **`getSchema()`** — Return a Zod + JSON Schema pair for structured
 *    output. Omit to receive raw text instead.
 * 2. **`buildPrompt(context)`** — Construct the prompt from the editor
 *    context (selection, full note, file path, cursor position).
 * 3. **`render(editor, result)`** — Write the validated result back into
 *    the editor. Default replaces the selection with stringified output.
 *
 * To add your own command, copy this file, change the schema/prompt/render,
 * and register it in `main.ts`.
 */
export class ExpandCommand extends BaseCommand<{ text: string }> {
	readonly id = "claude-bridge-expand";
	readonly name = "Expand selection with Claude";

	constructor(sessionManager: SessionManager, settings: ClaudeBridgeSettings, logger: Logger) {
		super(sessionManager, settings, logger);
	}

	getSchema(): CommandSchema<{ text: string }> {
		return TextResponseSchema;
	}

	buildPrompt(context: CommandContext): string {
		return [
			"Expand and improve the following text.",
			"Keep the same tone and style.",
			"Return only the improved text, no preamble.",
			"",
			"---",
			context.selection,
			"---",
		].join("\n");
	}

	render(editor: Editor, result: CommandResult<{ text: string }>): void {
		editor.replaceSelection(result.output.text);
	}
}
