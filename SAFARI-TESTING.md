# Safari experimental build

This is a local test port, not a verified Safari release. Do not restart Safari or automate its UI; the tester controls browser clicks and permissions.

All Safari port work was done by Codex and GPT Sol 6.1. The fork maintainer performed the manual browser testing. This port is unofficial; the upstream project and its license remain unchanged.

## Build and verification

- `node scripts/build-safari.mjs` produces `dist/prod.safari` using the upstream Firefox target, embeds stylesheet images as data URLs to avoid Firefox-only resource schemes, and removes Firefox manifest metadata and unsupported `options_ui.open_in_tab`.
- `node --test tests/page-initialization.test.mjs` reproduces concurrent separately evaluated content scripts sharing one document and verifies only one menu/features pass is applied.
- `npm run check` verifies TypeScript and Svelte.

The shared Page runner claims the document synchronously before any async initialization, using a DOM attribute shared between script evaluations. Initialization failure before UI insertion releases the marker. A fresh document gets its own marker.

## Build a macOS app from source

Prerequisites: macOS, full Xcode with its command-line tools selected, and Node.js 22.16 or newer (the Safari build script uses `import.meta.dirname`). Run these commands from the repository root:

```sh
npm ci --ignore-scripts
node --test tests/page-initialization.test.mjs
npm run check
node scripts/build-safari.mjs
xcrun safari-web-extension-converter dist/prod.safari \
  --project-location safari-rebuilt \
  --app-name AugmentedSteam \
  --bundle-identifier com.markc.AugmentedSteam \
  --macos-only --copy-resources --no-open --no-prompt
xcodebuild -project safari-rebuilt/AugmentedSteam/AugmentedSteam.xcodeproj \
  -scheme AugmentedSteam -configuration Release \
  -derivedDataPath .derived-data-safari-rebuilt \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
codesign --verify --deep --strict \
  .derived-data-safari-rebuilt/Build/Products/Release/AugmentedSteam.app
```

The converter expects a new output directory. On a subsequent build, preserve or remove only the generated `safari-rebuilt` directory before regenerating it. You may substitute your own bundle identifier when generating the wrapper. Generated Xcode projects, apps, screenshots, and build logs are intentionally excluded from Git.

Copy the resulting app to `~/Applications`, open it, and use its button to open Safari Extensions settings. When replacing an existing app, move the old copy aside first rather than merging bundles: obsolete Debug dylibs can invalidate a Release app's signature. Enable **Allow unsigned extensions** in Safari's Developer settings, approve the prompt, enable the extension, and allow access to `store.steampowered.com` and `steamcommunity.com`. Do not enable it alongside the temporary extension. No browser restart is required by these instructions.

If the installed extension is absent even with unsigned extensions allowed, inspect registrations:

```sh
pluginkit -m -A -D -v -i com.markc.AugmentedSteam.Extension
```

Unregister only stale build-directory `.appex` copies with `pluginkit -r "<exact stale path>"`, then register the installed copy with `pluginkit -a "$HOME/Applications/AugmentedSteam.app/Contents/PlugIns/AugmentedSteam Extension.appex"`. Read the registrations back and reopen the wrapper's Safari settings button. Do not unregister unrelated extensions or delete browser state.

## Manual acceptance

Disable/remove the old temporary Augmented Steam extension through Safari's UI, without quitting Safari. Add `dist/prod.safari` using Settings > Developer > Add Temporary Extension. Enable it and grant Steam website permissions if requested. Use a new game tab; an existing corrupted DOM cannot be repaired by this build.

Check initial load, reload, and navigation to another game. Each document should have one menu, one support row, one set of developer/publisher controls, and one version banner (not an aggregated xN row). Firefox-scheme stylesheet resource errors should disappear.

## Manual test results

The tester reported the following results with the temporary Safari bundle:

- Store-page initialization and reload: no duplicate UI after the document guard fix.
- Current/best pricing: visible after the API cooldown.
- Regional pricing and SteamPeek: visible when enabled, with no new console errors.
- Navigation between game pages and Steam search filters: appear to work, with no new console errors.
- Community profile, inventory item selection, and Community Market browsing: tester reported the suggested display-only checks seemed to pass, with no console errors. This does not verify every optional feature or transactional operations such as selling, trading, or placing orders.
- Wishlist: tester reported the suggested browsing, sorting, and navigation checks looked good. Individual optional enhancements were not separately enumerated.

Earlier API requests returned HTTP 429 accompanied by Safari CORS errors. Later manual tests succeeded after a cooldown without a network-permission patch. This supports a transient rate-limit diagnosis; it does not verify graceful handling of future API failures.

Remaining unverified issues: full MAIN-world script compatibility, Steam 403 responses, invalid countdown input, missing homepage nodes, graceful background request failure handling, optional features not exercised by the manual checks, and settings persistence across browser restarts. Preventing duplicate initialization does not explain why Safari scheduled repeated scripts.

## Rebuilt native app

The corrected Safari bundle was packaged in `safari-rebuilt/AugmentedSteam/AugmentedSteam.xcodeproj` and built as a Release app with ad-hoc signing. The installed copy at `~/Applications/AugmentedSteam.app` passed strict signature verification and exact file comparison with the build artifact. All 361 generated extension files were verified against the embedded resources. The regression test passed, and TypeScript/Svelte checks reported zero errors or warnings.

The converter still warns about the manifest `world` key. Disable the temporary extension before enabling the installed extension, so both copies never run together. No Safari restart was performed by the agent during rebuilding. A previous merged installation copy is retained locally at `.safari-install-backup.app`; it is not a clean rollback artifact.

After the tester removed the temporary extension and restarted Safari, the installed extension initially did not appear even with unsigned extensions allowed. PlugInKit listed three copies with the same identifier. Removing registrations for the old Debug and new Release build-directory copies, then explicitly registering the installed `.appex`, left only `~/Applications/AugmentedSteam.app` registered. The tester subsequently reported that the extension appeared, enabled it, and confirmed everything seemed to work after the installed-app test instructions. This establishes manual acceptance for the installed local app, not exhaustive compatibility or restart persistence of the enabled app.

This app is ad-hoc signed. Safari may require Allow unsigned extensions to be enabled again after a restart. No Developer ID signing, notarization, or App Store distribution was performed.
