import { md5 } from "js-md5";
import { TAbstractFile, TFile } from "obsidian";

export function isAnnexPointer(file: TAbstractFile): file is TFile {
	return (
		file instanceof TFile &&
		file.stat.size > 50 &&
		file.stat.size < 200 &&
		file.extension !== "md"
	);
}
function hashdirmixed(key: string) {
	const digest = md5.arrayBuffer(key);
	const first_word = new Uint32Array(digest)[0];
	if (!first_word) throw new Error("Empty key!");
	const nums = [
		(first_word >> (6 * 0)) & 31,
		(first_word >> (6 * 1)) & 31,
		(first_word >> (6 * 2)) & 31,
		(first_word >> (6 * 3)) & 31,
	] as const;
	const letters = "0123456789zqjxkmvwgpfZQJXKMVWGPF";
	return `${letters[nums[1]]}${letters[nums[0]]}/${letters[nums[3]]}${letters[nums[2]]}/`;
}

export function annexPointerToObjectpath(pointer: string) {
	const match = /^\/annex\/objects\/([^/]*)$/.exec(pointer);
	if (!match?.[1]) return;
	const key = match[1].slice(0, -1);
	return `${hashdirmixed(key)}${key}/${key}`;
}
