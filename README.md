# Window Freeze

Firefox extension. Auto Tab Discard and Firefox's own unloader only discard
background tabs, so with one window per sway workspace every window's active
tab stays loaded. This extension covers the active tab of a window that has been
unfocused for N minutes (default 5, options page) with a placeholder page
titled `Frozen: <original title>`, then discards the tab. Refocusing the window,
or the Resume button, reactivates the tab and closes the placeholder.

The title prefix keeps sway `[title=...]` criteria and rofi matching working;
`$DOTFILES/scripts/firefox-restart.py` strips it when matching windows.

Toolbar popup and keyboard shortcuts (about:addons → Manage Extension Shortcuts;
none bound by default): freeze this window now; this window no freeze for 1 h /
never / clear; all windows pause 1 h / pause / resume. The popup's status line
shows frozen windows and unloaded/total tabs.

With Auto Tab Discard: the two do not overlap. Auto Tab Discard unloads
*background* tabs by its own rules; this extension only ever touches the one
*active* tab per window, which Auto Tab Discard cannot. Both use the same
`tabs.discard`, so a tab unloaded by either shows the same way (greyed title,
reload on activation). No settings on either side are needed for them to coexist.

Skipped: audible tabs, already-discarded tabs, non-http(s)/file pages, and tabs
whose discard is refused (the placeholder stays, the tab remains loaded).

Build and sign (unlisted on AMO, auto-approved): bump `version` in `manifest.json`,
then with the AMO credentials from `~/syncthing/secrets/firefox-dev` in
`WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET`:
`npx --yes web-ext@latest sign --channel unlisted --source-dir . --ignore-files window-freeze.xpi README.md .gitignore`.
The signed xpi lands in `web-ext-artifacts/`; open it in Firefox to install.
Fedora's Firefox 157 enforces signing, so `xpinstall.signatures.required=false` does not help.
