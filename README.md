# Window Freeze

Firefox extension that unloads the tabs of windows you are not using,
including the **active** tab, which no other tab unloader can reach.

Tab unloaders (Auto Tab Discard, Firefox's own low-memory unloader) only ever
discard background tabs. If you keep one window per workspace or per monitor,
every window's selected tab stays loaded for days: Gmail, Slack, Docs, each in
its own window, each leaking. Window Freeze covers that tab with a placeholder
and discards it.

## What it does

- A window that has been unfocused for N minutes (default 5) gets a placeholder
  tab in front of its active tab, and the active tab is discarded, along with
  the window's other tabs (option, on by default). The placeholder shows a
  blurred screenshot of the page with its favicon and title.
- Alternatively the placeholder can be a text snapshot of the page (the
  `reader` style): headings, paragraphs, lists, tables and links, in a
  scrollable column at the scroll position the page was at. Reading and
  scrolling do not thaw; a click, a key or a link does, and a link also takes
  the thawed tab there. Pages with under 200 characters of text (apps, canvas
  pages, restricted pages) fall back to the screenshot.
- The window title becomes `Frozen: <title>` by default, so window-manager
  rules and launchers that match on title keep working.
- The window thaws when it has been focused for a couple of seconds (default 2;
  0 for immediately), or at once on a click or keypress on the placeholder. The
  original tab is reactivated and the placeholder closed. Reactivating a
  discarded tab is a page load; it starts as soon as the window is focused, so
  the dwell hides most of it.
- Optionally, a window that is on screen but unfocused (another monitor, or a
  tiled neighbour) counts as in use: it is not frozen and, if frozen, thaws.
  This uses the page visibility state, which depends on the compositor
  reporting occlusion; the popup shows how many windows Firefox thinks are on
  screen so you can check before enabling it.
- Background tabs in any window are unloaded after they have been out of view
  for M minutes (default 30; 0 disables), with a title prefix (default `💤 `)
  that the tab strip shows until the tab is next loaded.
- Frozen windows survive a Firefox restart: the placeholder's link to its tab is
  kept in per-tab session data.
- Toolbar popup and keyboard shortcuts (bind them under about:addons → Manage
  Extension Shortcuts): freeze this window now; this window no freeze for 1 h /
  never / clear; freeze all windows; pause 1 h / pause / resume. The popup shows
  how many windows are frozen and how many tabs are unloaded. The page context
  menu has "Never freeze this site" and "Freeze this window".

Popup and web-app windows have no tab strip, so there the tab itself navigates
to the placeholder and thawing goes back in history; the page reloads either
way.

Skipped: audible tabs, already-discarded tabs, non-http(s)/file pages, URLs on
the never-freeze list, pinned tabs and tabs with an edited form field (both
options, on by default), and tabs whose discard Firefox refuses (the
placeholder stays, the tab remains loaded).

## Options

Timing, the title and label templates (`{title}` `{url}` `{host}` `{date}`
`{time}`), the placeholder look (blurred or dimmed screenshot, a solid
colour, or a reader text snapshot; blur radius; darkening; favicon and label on
or off; text snapshot size cap), and a never-freeze
list of URL patterns (`*` wildcard, substring otherwise). A live preview sits
beside the settings.

## With Auto Tab Discard

Compatible but redundant: with whole-window freezing and the background-tab
timer on, Window Freeze covers what Auto Tab Discard does. Both use the same
`tabs.discard`, so an unloaded tab looks and behaves the same whichever did it;
the exclusion lists are separate.

## Prior art

Every tab unloader stops at the selected tab of each window because
[`tabs.discard`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/discard)
skips it, and Firefox's own unloader and Chrome's Memory Saver do the same.
[Auto Tab Discard](https://github.com/rNeomy/auto-tab-discard) has an option to
open a blank page so the active tab can be discarded, but only from its manual
"discard" commands, with a plain text placeholder and no restore on refocus;
[issue #127](https://github.com/rNeomy/auto-tab-discard/issues/127) asks for the
automatic version. [Dormancy](https://github.com/autonome/Dormancy) treats
unfocused windows' tabs as candidates but cannot touch their selected tab.

## Install

Not on addons.mozilla.org yet. Download the signed `.xpi` from the releases
page and open it in Firefox.

To build from source: sign it unlisted with
`npx web-ext sign --channel unlisted --source-dir . --ignore-files README.md LICENSE .gitignore`
using your own AMO API credentials in `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET`.
Release builds of Firefox require signing. For a quick trial, about:debugging →
Load Temporary Add-on works without signing but is lost on restart.

## Permissions

`tabs` and `sessions` to swap tabs and remember which placeholder belongs to
which tab; `<all_urls>` for the screenshot and the text snapshot at freeze time;
`storage` and `unlimitedStorage` for settings and the per-window snapshots;
`alarms` for the once-a-minute check. Nothing leaves the browser.

MIT.
