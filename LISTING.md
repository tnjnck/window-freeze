# AMO listing text

## Summary (≤250 chars)

Unloads the tabs of windows you have not used for a while, including each window's active tab, which other tab unloaders cannot reach. A blurred placeholder stands in; focusing the window brings the page back.

## Description

Tab unloaders (Auto Tab Discard, Firefox's own low-memory unloader, Chrome's Memory Saver) only unload background tabs. The selected tab of every window is exempt, even when that window has sat unfocused for hours. If you keep one window per workspace or per monitor, every window keeps a live page in memory: Gmail, Slack, Docs, each in its own window, each growing for days.

Window Freeze fixes that. After a window has been unfocused for a few minutes it puts a placeholder in front of the active tab, a blurred screenshot of the page with its favicon and title, and unloads the tab. When you come back to the window, by focusing it for a moment or clicking the placeholder, the page is loaded again and the placeholder removed. The window's other tabs are unloaded at the same time, and background tabs in any window are unloaded after they have been out of view for a while, so no second unloader is needed.

The window title becomes "Frozen: <title>" (configurable), so window-manager rules, launchers and tab-search tools that match on titles keep working.

Features
• Freeze after N minutes unfocused; thaw after a short focus dwell, or at once on click or key
• Whole-window unloading, and a timer for background tabs out of view
• Never-freeze list of URL patterns, plus "Never freeze this site" in the page context menu
• Pinned tabs, tabs playing audio and tabs with typed-in text are left loaded
• Toolbar popup: freeze this window or all windows, per-window exemptions, global pause, counts of frozen windows and unloaded tabs
• Keyboard shortcuts for every action (bind them under Manage Extension Shortcuts)
• Placeholder look: blurred or dimmed screenshot or a solid colour, title and label templates, live preview in the settings
• Frozen windows survive a Firefox restart

Unloading a tab is the same as Firefox's own tab unloading: the page is reloaded when you return, so scroll position is kept but page state that was only in memory is not. Light and dark themes supported. No data is collected or sent anywhere.

Source: https://github.com/tnjnck/window-freeze

## Privacy policy

Window Freeze does not collect, store or transmit any data. Screenshots taken for the placeholder are kept in the extension's local storage on your computer only and deleted when the placeholder closes. There are no network requests.

## Notes to reviewer

- `<all_urls>` is needed solely for `tabs.captureVisibleTab`, which takes the screenshot shown on the placeholder at the moment a window freezes. No content scripts are injected on page load.
- `tabs.executeScript` is used in two places, both immediately before a tab is unloaded: to check whether any text field has typed-in content (so such tabs are left loaded), and to prefix the tab's title so the tab strip marks it as unloaded. Both are inline snippets in background.js (`hasEditedForm`, `unload`).
- `sessions` stores a token on the original tab so the placeholder can find it again after a restart; nothing else is written to session data.
- The extension makes no network requests of any kind and has no remote code. Source files are shipped as written; nothing is minified or transpiled.
