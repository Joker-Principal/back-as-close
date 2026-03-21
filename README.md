# back as close

This Chrome extension closes the current tab when you trigger Back at the beginning of its history, and lets you quickly restore it if the close was accidental.

## What It Does

- Normal Back navigation still works when the current tab has earlier history entries.
- If there is nothing left to go back to, the extension closes the current tab instead.
- If the tab was closed by mistake, you can use Forward within a short time window to restore it.
- A lightweight banner appears after the tab closes, showing the closed tab title and a restore button.
- The banner adapts to light and dark themes automatically.

## Typical Flow

1. Open a page and browse normally.
2. Trigger Back with your mouse side button or keyboard shortcut.
3. If the tab can still go back, the page navigates normally.
4. If the tab cannot go back anymore, the tab closes.
5. If that close was accidental, trigger Forward or click the banner button to restore the tab before the timeout expires.

## Supported Shortcuts

- Back via mouse side back button
- Back via `Alt+Left` or the browser back key
- Forward-based restore via mouse side forward button
- Forward-based restore via `Alt+Right` or the browser forward key

## Restore Experience

- After a close, the extension keeps a short restore window.
- During that time, the current page can show a restore banner.
- The banner includes the closed tab title, a direct restore button, and a visual countdown.
- Once the timeout expires, Forward returns to its normal browser behavior.

## Options

- You can configure the restore timeout in the extension options page.
- The timeout is stored with Chrome sync storage.
- The default value is small on purpose, so accidental closes are easy to undo without changing normal browsing too much.

## Limits

- The browser toolbar Back button cannot be intercepted by Chrome extensions.
- Pages using `data:`, `blob:`, or `about:` URLs are not handled because content scripts do not run there.
- The restore window is temporary. If it expires, the extension stops offering recovery for that tab.

## Installation

1. Clone the repository or download the source code.
2. Install dependencies with `npm install`.
3. Build the extension with `npm run build`.
4. Open Chrome and navigate to `chrome://extensions/`.
5. Enable **Developer mode** (toggle in top-right corner).
6. Click **Load unpacked** and select the `dist` directory.

The extension starts working immediately after loading.

## Development

- Source code is written in TypeScript.
- Build output is generated into `dist/`.
- Use `npm run watch` during development.
- Use `npm run typecheck` for type checking only.

## Project Structure

- `src/history-check.ts`: content script bootstrap
- `src/history-main.ts`: page-side interaction and banner UI
- `src/service-worker.ts`: close and restore coordination
- `src/options.html` and `src/options.ts`: restore timeout settings

## Debugging

Debug logs are enabled by default.

- Content logs appear in the page DevTools console with the prefix `[BackAsClose][Content]`.
- Background logs appear in the extension service worker console with the prefix `[BackAsClose][Background]`.
- Disable logs by setting `DEBUG_LOG_ENABLED = false` in `src/history-main.ts` and `src/service-worker.ts`.

## Manual Verification

1. Open a new tab and navigate: **Page A** → **Page B** → **Page C**.
2. Press Back until you return to **Page A**.
3. Press Back again.
4. Verify that the tab closes.
5. Within the configured restore window, press Forward or click **Restore** in the banner.
6. Verify that the closed tab reopens.
