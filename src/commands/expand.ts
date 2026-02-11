import { Editor } from "obsidian";
import { TextResponseSchema } from "../schemas";
import type { Logger } from "../logger";
import type {
	ClaudeBridgeSettings,
	CommandContext,
	CommandResult,
	CommandSchema,
} from "../types";
import { SessionManager } from "../session-manager";
import { BaseCommand } from "./base-command";

/**
 * Proof-of-concept command: "Expand selection with Claude"
 *
 * Takes the selected text, asks Claude to expand/improve it,
 * and replaces the selection with the result.
 */
export class ExpandCommand extends BaseCommand<{ text: string }> {
	readonly id = "claude-bridge-expand";
	readonly name = "Expand selection with Claude";

	constructor(
		sessionManager: SessionManager,
		settings: ClaudeBridgeSettings,
		logger: Logger,
	) {
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

	render(
		editor: Editor,
		result: CommandResult<{ text: string }>,
	): void {
		editor.replaceSelection(result.output.text);
	}
}
