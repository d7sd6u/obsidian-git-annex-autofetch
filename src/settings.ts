import { PluginSettingTab, App, Setting } from "obsidian";
import Main from "./main";

export interface Settings {
	compressedImageUrlTemplate?: string;
	objectUrlTemplate?: string;
}
export const DEFAULT_SETTINGS: Settings = {};
export class MainPluginSettingsTab extends PluginSettingTab {
	constructor(
		app: App,
		override plugin: Main,
	) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Image compression URL template")
			.setDesc(
				"URL template that is used to get URL of the compressed version of an image",
			)
			.addTextArea((textArea) => {
				textArea
					.setValue(
						this.plugin.settings.compressedImageUrlTemplate ?? "",
					)
					.onChange(async (v) => {
						this.plugin.settings.compressedImageUrlTemplate = v;
						await this.plugin.saveSettings();
					})
					.setPlaceholder(
						`https://imaginary.example.org/very-very-secret-string/resize?width=300&url=http://nginx/{{{objectpath}}}`,
					);
				textArea.inputEl.classList.add("small-settings-text-area");
			});
		new Setting(containerEl)
			.setName("Object storage URL template")
			.setDesc("URL template that is used to get URL of given blob")
			.addTextArea((textArea) => {
				textArea
					.setValue(this.plugin.settings.objectUrlTemplate ?? "")
					.onChange(async (v) => {
						this.plugin.settings.objectUrlTemplate = v;
						await this.plugin.saveSettings();
					})
					.setPlaceholder(
						`https://nginx.example.org/raw/very-very-secret-string/{{{objectpath}}}`,
					);
				textArea.inputEl.classList.add(
					"git-annex-autofetch-small-settings-text-area",
				);
			});
	}
}
