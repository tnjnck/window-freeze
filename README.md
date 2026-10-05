# Window Freeze

Firefox extension that unloads the **active** tab of windows you are not using.

Tab unloaders (Auto Tab Discard, Firefox's own low-memory unloader) only ever
discard background tabs. If you keep one window per workspace or per monitor,
every window's selected tab stays loaded for days: Gmail, Slack, Docs, each in
its own window, each leaking. Window Freeze covers that tab with a placeholder
and discards it.

## What it does

- A window that has been unfocused for N minutes (default 5) gets a placeholder
  tab in front of its active tab, and the active tab is discarded. The
  placeholder shows a blurred screenshot of the page with its favicon and title.
- The window title becomes `Frozen: <title>` by default, so window-manager
  rules and launchers that match on title keep working.
- The window thaws when it has been focused for a couple of seconds (default 2;
  0 for immediately), or at once on a click or keypress on the placeholder. The
  original tab is reactivated and the placeholder closed. Reactivating a
  discarded tab is a page load.
- Frozen windows survive a Firefox restart: the placeholder's link to its tab is
  kept in per-tab session data.
- Toolbar popup and keyboard shortcuts (bind them under about:addons → Manage
  Extension Shortcuts): freeze this window now; this window no freeze for 1 h /
  never / clear; all windows pause 1 h / pause / resume. The popup also shows
  how many windows are frozen and how many tabs are unloaded in total.

Skipped: audible tabs, already-discarded tabs, non-http(s)/file pages, URLs on
the never-freeze list, popup and web-app windows (no tab strip to put a
placeholder in), and tabs whose discard Firefox refuses (the placeholder stays,
the tab remains loaded).

## Options

Timing, the title and label templates (`{title}` `{url}` `{host}` `{date}`
`{time}`), the placeholder look (blurred or dimmed screenshot, or a solid
colour; blur radius; darkening; favicon and label on or off), and a never-freeze
list of URL patterns (`*` wildcard, substring otherwise). A live preview sits
beside the settings.

## With Auto Tab Discard

They do not overlap. Auto Tab Discard unloads background tabs by its own rules;
Window Freeze only touches the one active tab per window. Both use the same
`tabs.discard`, so an unloaded tab looks and behaves the same whichever did it.

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
which tab; `<all_urls>` only for the screenshot at freeze time; `storage` for
settings; `alarms` for the once-a-minute check. Nothing leaves the browser.

MIT.
