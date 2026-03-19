# back as close

This Chrome extension automatically closes the current tab when you trigger Back at the end of browser history (the first page in the session).

## How It Works

The extension intercepts back navigation attempts and determines whether more history exists:

1. When you activate Back (mouse button, Alt+Left, or BrowserBack key), the extension calls `history.back()`.
2. It waits 200ms for navigation to complete, then checks if the URL changed.
3. **If URL changed**: Normal navigation occurred. The extension does nothing.
4. **If URL unchanged**: You're at the first page (no history left). The extension closes the tab.

This approach is simpler and more reliable than checking `history.length`, which can be affected by same-origin redirects and other edge cases.

## Supported Triggers

- **Mouse side back button** — Captured via `auxclick` event
- **Alt+Left keyboard shortcut** — Captured via `keydown` event
- **BrowserBack key** — Captured when the browser emits the BrowserBack key event

## Not Supported

- Browser toolbar Back button (cannot be intercepted by Chrome extensions)
- Pages in `data:`, `blob:`, or `about:` protocols (content scripts don't run there)

## Installation

1. Clone the repository or download the source code.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked** and select the directory containing this project.

The extension will load immediately and start intercepting back navigation on all pages.

## UI Surface

- The extension does not provide a popup or toolbar action workflow.
- After installation, it runs only through the registered content script and background service worker.

## Debug Logging

Debug logs are enabled by default and provide detailed information about extension behavior:

- **Content script logs** appear in the page's DevTools Console with prefix `[BackAsClose][Content]`.
  - View logs: Right-click on any page → **Inspect** → **Console** tab.
  - Logs show: Back events captured, URL comparisons, close decisions, and page unload events.

- **Background service worker logs** appear in the extension's service worker console with prefix `[BackAsClose][Background]`.
  - View logs: Open `chrome://extensions/` → Find this extension → Click **Service worker** under "Inspect".
  - Logs show: Tab close operations and any errors encountered.

Disable logs by setting `DEBUG_LOG_ENABLED = false` in `src/history-check.js` and `src/service-worker.js`.

## Manual Verification

Test the extension with this simple scenario:

1. Open a new tab and navigate: **Page A** → **Page B** → **Page C**.
2. Trigger Back using your mouse side button (or press Alt+Left).
3. Verify: You're now on **Page B**. Trigger Back again.
4. Verify: You're now on **Page A**. This shows normal back navigation works.
5. Trigger Back one more time while on **Page A**.
6. Expected result: **The tab closes** (since there's no history to go back to).

You can also open the DevTools Console (F12) to see detailed logs from `[BackAsClose][Content]` showing each decision.

## Implementation Notes

- **URL-based detection**: The extension compares URLs before and after `history.back()` to determine if navigation occurred, rather than checking `history.length`. This is more reliable.
  
- **Stateless design**: The extension has no persistent state, session storage, or cross-tab communication. Each tab operates independently.

- **Platform compatibility**: Works on any page served via http, https, or file protocols. Skips editable elements (INPUT, TEXTAREA, SELECT, contentEditable) to avoid interfering with text editing.

- **Tab isolation**: When a tab is closing, the `beforeunload` event sets a flag to prevent the background script from receiving stale messages, ensuring no cross-tab side effects.

- **Lightweight**: The entire extension is ~200 lines of code with zero external dependencies.
