# Window Freeze

Firefox extension. Auto Tab Discard and Firefox's own unloader only discard
background tabs, so with one window per sway workspace every window's active
tab stays loaded. This extension covers the active tab of a window that has been
unfocused for N minutes (default 5, options page) with a placeholder page
titled `Frozen: <original title>`, then discards the tab. Refocusing the window,
or the Resume button, reactivates the tab and closes the placeholder.

The title prefix keeps sway `[title=...]` criteria and rofi matching working;
`$DOTFILES/scripts/firefox-restart.py` strips it when matching windows.

Skipped: audible tabs, already-discarded tabs, non-http(s)/file pages, and tabs
whose discard is refused (the placeholder stays, the tab remains loaded).

Build: `zip -r ../window-freeze.xpi . -x '.git/*' README.md`.
Install: about:debugging → Load Temporary Add-on (until restart), or
`xpinstall.signatures.required=false` if this build allows it, or sign
unlisted on AMO with `npx web-ext sign`.
