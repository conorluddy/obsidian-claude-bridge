import { App, PluginSettingTab, Setting } from "obsidian";
import type ClaudeBridgePlugin from "./main";

/**
 * Settings tab UI.
 *
 * Every `.onChange` callback saves immediately — this is the standard Obsidian
 * convention so settings persist even if the user closes the tab without an
 * explicit "Save" action.
 */
export class ClaudeBridgeSettingTab extends PluginSettingTab {
	plugin: ClaudeBridgePlugin;

	constructor(app: App, plugin: ClaudeBridgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"Log verbose trace output to the DevTools console (Cmd+Option+I). Errors always log regardless of this setting.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Claude CLI path")
			.setDesc("Absolute path to the claude binary. Auto-detected on load if left empty.")
			.addText((text) =>
				text
					.setPlaceholder("/Users/you/.local/bin/claude")
					.setValue(this.plugin.settings.cliPath)
					.onChange(async (value) => {
						this.plugin.settings.cliPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("System prompt")
			.setDesc("Default system prompt sent with every Claude call")
			.addTextArea((text) =>
				text
					.setPlaceholder("You are a helpful assistant...")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Claude model to use (e.g. sonnet, opus, haiku)")
			.addText((text) =>
				text
					.setPlaceholder("sonnet")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max budget (tokens)")
			.setDesc("Maximum token budget per Claude call")
			.addText((text) =>
				text
					.setPlaceholder("50000")
					.setValue(String(this.plugin.settings.maxBudgetTokens))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed > 0) {
							this.plugin.settings.maxBudgetTokens = parsed;
							await this.plugin.saveSettings();
						}
					}),
			);
	}
}
