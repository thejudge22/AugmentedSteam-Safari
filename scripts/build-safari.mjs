import fs from "node:fs/promises";
import path from "node:path";
import builder from "./tools/builder.mjs";

// Keep the upstream Firefox target unchanged; generate an isolated Safari test bundle.
await builder({browser: "firefox", dev: false});
const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "dist/prod.safari");
await fs.rm(target, {recursive: true, force: true});
await fs.cp(path.join(root, "dist/prod.firefox"), target, {recursive: true});
const mime = {".png": "image/png", ".gif": "image/gif", ".svg": "image/svg+xml", ".jpg": "image/jpeg"};
for (const entry of await fs.readdir(target, {recursive: true})) {
    if (!entry.endsWith(".css")) { continue; }
    const file = path.join(target, entry);
    let css = await fs.readFile(file, "utf8");
    const urls = new Set(css.match(/moz-extension:\/\/__MSG_@@extension_id__\/[^\s"')]+/g) ?? []);
    for (const url of urls) {
        const resource = url.replace("moz-extension://__MSG_@@extension_id__/", "");
        const type = mime[path.extname(resource)];
        if (!type) { throw new Error(`Unsupported Safari stylesheet resource: ${resource}`); }
        const bytes = await fs.readFile(path.join(target, resource));
        css = css.replaceAll(url, `data:${type};base64,${bytes.toString("base64")}`);
    }
    await fs.writeFile(file, css);
}
const manifestFile = path.join(target, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
delete manifest.browser_specific_settings;
delete manifest.options_ui.open_in_tab;
await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
console.log(`Safari test bundle: ${target}`);
