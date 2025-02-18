import { App, Component, View } from "obsidian";

export function hookIntoEmbedCreation(
	app: App,
	cb: (ext: string, component: Component) => void,
) {
	function patchEmbedCreator(ext: string) {
		const existing = app.embedRegistry.embedByExtension[ext];
		if (!existing) return;
		app.embedRegistry.embedByExtension[ext] = function (...args) {
			const view = existing.apply(this, args);
			cb(ext, view);
			return view;
		};
	}
	for (const ext of Object.keys(app.embedRegistry.embedByExtension)) {
		patchEmbedCreator(ext);
	}
}

export function hookIntoViewCreation(
	app: App,
	cb: (type: string, view: View) => void,
) {
	function patchViewCreator(type: string) {
		const existing = app.viewRegistry.viewByType[type];
		if (!existing) return;
		app.viewRegistry.viewByType[type] = function (...args) {
			const view = existing.apply(this, args);
			cb(type, view);
			return view;
		};
	}
	for (const type of Object.keys(app.viewRegistry.viewByType)) {
		patchViewCreator(type);
	}
	app.viewRegistry.on("view-registered", (registeredType) => {
		patchViewCreator(registeredType);
	});
}
