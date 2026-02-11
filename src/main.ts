import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { MarkdownView, Plugin } from "obsidian";
import { Logger } from "./logger";
import { SessionManager } from "./session-manager";
import { ClaudeBridgeSettingTab } from "./settings";
import { ExpandCommand } from "./commands/expand";
import { BaseCommand } from "./commands/base-command";
import type { ClaudeBridgeSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

// ---------------------------------------------------------------------------
// CLI path resolution constants
// ---------------------------------------------------------------------------

/** Timeout for the `which claude` fallback shell call (ms). */
const CLI_WHICH_TIMEOUT_MS = 3000;

/** Common install locations to check before falling back to `which`. */
const CLI_CANDIDATE_PATHS = [
	`${process.env.HOME || "/Users/" + process.env.USER}/.local/bin/claude`,
	"/usr/local/bin/claude",
	"/opt/homebrew/bin/claude",
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class ClaudeBridgePlugin extends Plugin {
	settings: ClaudeBridgeSettings = DEFAULT_SETTINGS;
	sessionManager: SessionManager = undefined!;
	logger: Logger = undefined!;

	private commands: BaseCommand<unknown>[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.logger = new Logger(() => this.settings.debugMode);

		this.logger.info("plugin", "Loading claude-bridge plugin");

		if (!this.settings.cliPath) {
			this.settings.cliPath = this.resolveCliPath();
			this.logger.info("plugin", `Resolved CLI path: ${this.settings.cliPath || "(not found)"}`);
		}

		this.sessionManager = new SessionManager(this.app, this.logger);

		this.registerCommands([new ExpandCommand(this.sessionManager, this.settings, this.logger)]);

		this.addSettingTab(new ClaudeBridgeSettingTab(this.app, this));

		this.logger.info("plugin", `Plugin loaded — ${this.commands.length} command(s) registered`);
	}

	onunload(): void {
		this.logger.info("plugin", "Unloading claude-bridge plugin");
	}

	/**
	 * Register an array of BaseCommand instances as Obsidian editor commands.
	 * Called internally and available for future plugins to extend.
	 */
	registerCommands(commands: BaseCommand<unknown>[]): void {
		for (const cmd of commands) {
			this.commands.push(cmd);
			this.addCommand({
				id: cmd.id,
				name: cmd.name,
				editorCallback: (editor, view) => cmd.execute(editor, view as MarkdownView),
			});
			this.logger.debug("plugin", `Registered command: ${cmd.id} ("${cmd.name}")`);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Try to find the claude binary.
	 *
	 * QUIRK: Obsidian runs inside Electron, which does NOT inherit your
	 * shell's PATH. So `claude` won't be found via a bare `spawn("claude")`.
	 * We check known install locations first, then fall back to spawning a
	 * login shell (`zsh -lc "which claude"`) as a last resort.
	 */
	private resolveCliPath(): string {
		for (const candidate of CLI_CANDIDATE_PATHS) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		try {
			const result = execFileSync("/bin/zsh", ["-lc", "which claude"], {
				encoding: "utf-8",
				timeout: CLI_WHICH_TIMEOUT_MS,
			}).trim();
			if (result && existsSync(result)) return result;
		} catch {
			// Swallowed — we'll return empty and let the user configure manually
		}

		return "";
	}
}
