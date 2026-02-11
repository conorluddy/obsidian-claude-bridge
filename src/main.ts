import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { Plugin } from "obsidian";
import { Logger } from "./logger";
import { SessionManager } from "./session-manager";
import { ClaudeBridgeSettingTab } from "./settings";
import { ExpandCommand } from "./commands/expand";
import { BaseCommand } from "./commands/base-command";
import type { ClaudeBridgeSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export default class ClaudeBridgePlugin extends Plugin {
	settings: ClaudeBridgeSettings = DEFAULT_SETTINGS;
	sessionManager: SessionManager = undefined!;
	logger: Logger = undefined!;

	private commands: BaseCommand<unknown>[] = [];

	async onload() {
		await this.loadSettings();

		this.logger = new Logger(() => this.settings.debugMode);

		this.logger.info("plugin", "Loading claude-bridge plugin");

		if (!this.settings.cliPath) {
			this.settings.cliPath = this.resolveCliPath();
			this.logger.info(
				"plugin",
				`Resolved CLI path: ${this.settings.cliPath || "(not found)"}`,
			);
		}

		this.sessionManager = new SessionManager(this.app, this.logger);

		this.registerCommands([
			new ExpandCommand(this.sessionManager, this.settings, this.logger),
		]);

		this.addSettingTab(new ClaudeBridgeSettingTab(this.app, this));

		this.logger.info(
			"plugin",
			`Plugin loaded — ${this.commands.length} command(s) registered`,
		);
	}

	onunload() {
		this.logger.info("plugin", "Unloading claude-bridge plugin");
	}

	/**
	 * Register an array of BaseCommand instances as Obsidian editor commands.
	 * Called internally and available for future plugins to extend.
	 */
	registerCommands(commands: BaseCommand<unknown>[]) {
		for (const cmd of commands) {
			this.commands.push(cmd);
			this.addCommand({
				id: cmd.id,
				name: cmd.name,
				editorCallback: (editor, view) => cmd.execute(editor, view),
			});
			this.logger.debug(
				"plugin",
				`Registered command: ${cmd.id} ("${cmd.name}")`,
			);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Try to find the claude binary since Obsidian's env lacks the user's PATH.
	 * Checks common locations, then falls back to `which` via a login shell.
	 */
	private resolveCliPath(): string {
		const homeDir = process.env.HOME || "/Users/" + process.env.USER;
		const candidates = [
			`${homeDir}/.local/bin/claude`,
			"/usr/local/bin/claude",
			"/opt/homebrew/bin/claude",
		];

		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		// Last resort: ask a login shell
		try {
			const result = execFileSync("/bin/zsh", ["-lc", "which claude"], {
				encoding: "utf-8",
				timeout: 3000,
			}).trim();
			if (result && existsSync(result)) return result;
		} catch {
			// Swallowed — we'll return empty and let the user configure manually
		}

		return "";
	}
}
