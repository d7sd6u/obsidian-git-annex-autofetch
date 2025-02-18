import {
	App,
	Component,
	FileView,
	Notice,
	Platform,
	TFile,
	Vault,
} from "obsidian";

import { annexPointerToObjectpath, isAnnexPointer } from "./annex";
import { DEFAULT_SETTINGS, MainPluginSettingsTab } from "./settings";
import PluginWithSettings from "../obsidian-reusables/src/PluginWithSettings";
import {
	hookIntoEmbedCreation,
	hookIntoViewCreation,
} from "../obsidian-reusables/src/patchingUtils";

export default class Main extends PluginWithSettings(DEFAULT_SETTINGS) {
	resourcePathOverrides = new Map<string, string>();

	override onload() {
		void this.initSettings(MainPluginSettingsTab);

		this.addFileMenuOptions();

		this.patchOpenInDefaultApp();

		this.patchXHR();

		this.patchGetResourcePath();

		this.patchViews();

		this.patchEmbeds();
	}

	private patchEmbeds() {
		const patchedEmbeds: Record<string, boolean> = {};
		for (const type of ["image", "audio", "video", "pdf"]) {
			const typeExtensions = Object.entries(
				this.app.viewRegistry.typeByExtension,
			)
				.filter(([, t]) => type === t)
				.map(([ext]) => ext);

			if (!patchedEmbeds[type]) {
				hookIntoEmbedCreation(this.app, (ext, component) => {
					if (typeExtensions.includes(ext)) {
						const embed = component as EmbedComponent;
						const prototype = Object.getPrototypeOf(
							embed,
						) as EmbedComponentPrototype;
						this.registerPatch(prototype, {
							loadFile(next, plugin) {
								return async function () {
									if (this.file)
										await plugin.updateResourceOverride(
											this.file,
											type === "image",
											true,
										);
									return next.apply(this, []);
								};
							},
						});
					}
				});
				patchedEmbeds[type] = true;
			}
		}
	}

	private patchViews() {
		const patched: Record<string, boolean> = {};
		for (const type of ["image", "audio", "video", "pdf"]) {
			const patch = () => {
				const leafs = this.app.workspace.getLeavesOfType(type);
				const leaf = leafs[0];
				if (leaf) {
					patchV(Object.getPrototypeOf(leaf.view) as FileView);
				}
			};
			const patchV = (view: FileView) => {
				if (!patched[type]) {
					const precache = type === "pdf" && Platform.isDesktopApp;
					const download = type === "pdf" && Platform.isMobileApp;
					this.registerPatch(
						Object.getPrototypeOf(view) as FileView,
						{
							onLoadFile(next, plugin) {
								return async function (
									this: FileView,
									file,
									...rest
								) {
									if (download) {
										await plugin.downloadFileLocally(file);
									} else
										await plugin.updateResourceOverride(
											file,
											type === "image",
											precache,
										);
									await next.apply(this, [file, ...rest]);
								};
							},
						},
					);

					patched[type] = true;
				}
			};
			hookIntoViewCreation(this.app, (viewType, view) => {
				if (viewType === type && view instanceof FileView) {
					patchV(view);
				}
			});
			patch();
			this.app.workspace.on("active-leaf-change", patch);
		}
	}

	private patchGetResourcePath() {
		this.registerPatch(this.app.vault, {
			getResourcePath(next, plugin) {
				return function (this: Vault, file) {
					const override = plugin.resourcePathOverrides.get(
						file.path,
					);
					if (override) {
						new Notice("Using remote annex file...", 1000);

						return override;
					}
					const resourcePath = next.apply(this, [file]);
					void plugin
						.updateResourceOverride(
							file,
							["png", "jpg", "tiff", "jpeg"].includes(
								file.extension,
							),
							false,
						)
						.then((hasOverride) => {
							if (hasOverride) {
								plugin.resourcePathOverrides.set(
									resourcePath,
									plugin.resourcePathOverrides.get(
										file.path,
									) ?? resourcePath,
								);
								for (const el of Array.from(
									document.querySelectorAll(`[src]`),
								)) {
									if (el.getAttr("src") === resourcePath) {
										el.setAttr(
											"src",
											plugin.resourcePathOverrides.get(
												file.path,
											) ?? resourcePath,
										);
									}
								}
							}
						});

					return resourcePath;
				};
			},
		});
	}

	private patchXHR() {
		this.registerPatch(XMLHttpRequest.prototype, {
			open(next, plugin) {
				return function (
					this: XMLHttpRequest,
					...args:
						| [
								method: string,
								url: string | URL,
								async: boolean,
								username?: string | null | undefined,
								password?: string | null | undefined,
						  ]
						| [method: string, url: string | URL]
				) {
					const override = plugin.resourcePathOverrides.get(
						args[1].toString(),
					);
					if (override) {
						const prefix = "Started fetching annex file ";
						setTimeout(() => {
							const previous = this.onprogress;
							this.onprogress = (e) => {
								const percent = Math.floor(
									(e.loaded / e.total) * 100,
								);
								notice.setMessage(
									prefix + percent.toString() + "%",
								);
								previous?.apply(this, [e]);
							};
						});
						const notice = new Notice(prefix + "0%", 30000);
						this.onloadend = () => {
							notice.setMessage(prefix + "100" + "%");
							setTimeout(() => {
								notice.hide();
							}, 1000);
						};
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						next.apply(this, [
							args[0],
							override,
							args[2],
							args[3],
							args[4],
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
						] as any);
						return;
					}
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
					next.apply(this, args as any);

					return;
				};
			},
		});
	}

	private patchOpenInDefaultApp() {
		this.registerPatch(App.prototype, {
			openWithDefaultApp(next, plugin) {
				return function (this: App, ...args) {
					const file = this.vault.fileMap[args[0]];
					if (file && file instanceof TFile)
						void plugin.downloadFileLocally(file).then(() => {
							next.apply(this, args);
						});
				};
			},
		});
	}

	private addFileMenuOptions() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (isAnnexPointer(file)) {
					menu.addItem((item) => {
						item.setTitle("Download file locally")
							.setIcon("document")
							.onClick(() => {
								void this.downloadFileLocally(file);
							});
					});
				}
			}),
		);
	}

	private async updateResourceOverride(
		file: TFile,
		proxyAsImage: boolean,
		precache: boolean,
	) {
		const annexUrl = await this.getRemoteAnnexUrl(
			file,
			proxyAsImage,
			precache,
		);
		return !!annexUrl;
	}

	private async getRemoteAnnexUrl(
		file: TFile,
		proxyAsImage: boolean,
		precache: boolean,
	): Promise<string | undefined> {
		if (!isAnnexPointer(file)) return undefined;
		try {
			const objectpath = annexPointerToObjectpath(
				await this.app.vault.cachedRead(file),
			);
			if (!objectpath) return;

			const template =
				proxyAsImage &&
				!objectpath.endsWith(".gif") &&
				this.settings.compressedImageUrlTemplate !== ""
					? this.settings.compressedImageUrlTemplate
					: this.settings.objectUrlTemplate;
			const finalSrc = template?.replace("{{{objectpath}}}", objectpath);

			if (!finalSrc) return undefined;

			if (this.resourcePathOverrides.get(file.path) === finalSrc)
				return finalSrc;

			if (precache) {
				const prefix = "Downloading ";
				const notice = new Notice(prefix + "0%", 0);
				try {
					const response = await fetch(finalSrc);

					await getArrayBuffer(response, (rec, tot) => {
						const percent = Math.floor((rec / tot) * 100);
						notice.setMessage(prefix + percent.toString() + "%");
					});
				} catch (error) {
					notice.setMessage("Failed to precache!");
					console.error("failed to precache", error);
				} finally {
					setTimeout(() => {
						notice.hide();
					}, 1000);
				}
			}
			this.resourcePathOverrides.set(file.path, finalSrc);
			return undefined;
		} catch {
			return undefined;
		}
	}
	private async downloadFileLocally(file: TFile) {
		const url = await this.getRemoteAnnexUrl(file, false, false);
		if (url) {
			const response = await fetch(url);

			const prefix = "Downloading ";
			const notice = new Notice(prefix + "0%", 0);
			const arrayBuffer = await getArrayBuffer(response, (rec, tot) => {
				const percent = Math.floor((rec / tot) * 100);
				notice.setMessage(prefix + percent.toString() + "%");
			});

			this.resourcePathOverrides.delete(file.path);
			await this.app.vault.modifyBinary(file, arrayBuffer, file.stat);
			notice.setMessage("Downloaded " + file.name);
			setTimeout(() => {
				notice.hide();
			}, 1000);
		}
	}
}

async function getArrayBuffer(
	response: Response,
	onChunk: (received: number, total: number) => void,
) {
	const reader = response.body?.getReader();
	if (!reader) return response.arrayBuffer();

	const lengthHeader = response.headers.get("Content-Length");
	if (lengthHeader === null) return response.arrayBuffer();
	const contentLength = +lengthHeader;

	let receivedLength = 0;
	const chunks = [];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		chunks.push(value);
		receivedLength += value.length;

		onChunk(receivedLength, contentLength);
	}

	const chunksAll = new Uint8Array(receivedLength);
	let position = 0;
	for (const chunk of chunks) {
		chunksAll.set(chunk, position);
		position += chunk.length;
	}

	return chunksAll.buffer;
}

type EmbedComponent = Component & {
	file: TFile | undefined;
};
interface EmbedComponentPrototype extends EmbedComponent {
	loadFile: (this: EmbedComponent) => Promise<void>;
}
