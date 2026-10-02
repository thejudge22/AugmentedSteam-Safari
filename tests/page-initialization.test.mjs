import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import vm from "node:vm";
import {transform} from "esbuild";
import {JSDOM} from "jsdom";

async function loadPage(document, counters) {
    const source = (await readFile(new URL("../src/js/Content/Features/Page.ts", import.meta.url), "utf8"))
        .replace(/^import .*;\n/gm, "").replace("export default abstract class Page", "abstract class Page");
    const {code} = await transform(source + "\nglobalThis.TestPage = Page;", {loader: "ts"});
    const noop = async () => {};
    const scope = vm.createContext({
        document, window: {addEventListener() {}}, console: {log() {}, error() {}, group() {}, groupEnd() {}},
        Environment: {}, ContextType: {ContentScript: 1},
        SettingsStore: {init: async () => { counters.starts++; await Promise.resolve(); }},
        bootstrapDomPurify: noop, Localization: {init: noop}, CurrencyManager: {init: noop},
        AppConfigFactory: class {}, LanguageFactory: class {}, UserFactory: class {},
        Info: {version: "test"}, Config: {PublicHost: "test"}
    });
    vm.runInContext(code, scope);
    return scope.TestPage;
}

test("overlapping separately evaluated page scripts apply features only once per document", async () => {
    const {window} = new JSDOM("<html><body></body></html>");
    const counters = {starts: 0, menus: 0, features: 0};
    const First = await loadPage(window.document, counters);
    const Second = await loadPage(window.document, counters);
    const context = {create: async () => ({applyFeatures: async () => { counters.features++; }})};
    function page(Base) {
        return new class extends Base {
            check() { return true; }
            async getAppConfig() { return {}; }
            async getLanguage() { return null; }
            async getUser() { return {}; }
            async preApply() {
                counters.menus++;
                window.document.body.insertAdjacentHTML("beforeend", '<div id="as-menu"></div>');
            }
        }(context);
    }
    await Promise.all([page(First).run(), page(Second).run()]);
    assert.equal(counters.menus, 1, "duplicate menus from concurrent initialization");
    assert.equal(counters.features, 1);
    await page(Second).run();
    assert.equal(counters.menus, 1);
    window.close();
});
