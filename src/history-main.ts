import {
    createCloseTabMessage,
    createRestoreTabMessage,
    createTryRestoreMessage,
    MESSAGE_TYPES,
    type HideRestoreBannerMessage,
    type ShowRestoreBannerMessage
} from './shared/message-types.js';

const DEBUG_LOG_ENABLED = true;
const LOG_PREFIX = '[BackAsClose][Content]';

let pageUnloading = false;
let restoreBannerElement: HTMLDivElement | null = null;
let restoreBannerTimerId: number | null = null;
let restoreBannerCountdownIntervalId: number | null = null;

function logDebug(message: string, context: Record<string, unknown> = {}): void {
    if (!DEBUG_LOG_ENABLED) {
        return;
    }

    console.debug(`${LOG_PREFIX} ${message}`, {
        at: new Date().toISOString(),
        ...context
    });
}

function clearRestoreBannerTimer(): void {
    if (restoreBannerTimerId !== null) {
        window.clearTimeout(restoreBannerTimerId);
        restoreBannerTimerId = null;
    }

    if (restoreBannerCountdownIntervalId !== null) {
        window.clearInterval(restoreBannerCountdownIntervalId);
        restoreBannerCountdownIntervalId = null;
    }
}

function hideRestoreBanner(): void {
    clearRestoreBannerTimer();

    if (restoreBannerElement?.parentNode) {
        restoreBannerElement.parentNode.removeChild(restoreBannerElement);
    }

    restoreBannerElement = null;
}

function getCompactTitle(title: string | undefined, maxLength = 32): string {
    const normalized = (title || '未知页面').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

function getBannerThemeStyles(): {
    bannerBackground: string;
    textBackground: string;
    borderColor: string;
    textColor: string;
    buttonBackground: string;
    buttonTextColor: string;
    buttonProgressBackground: string;
} {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (prefersDark) {
        return {
            bannerBackground: 'rgba(15, 23, 42, 0.72)',
            textBackground: 'rgba(30, 41, 59, 0.58)',
            borderColor: 'rgba(148, 163, 184, 0.22)',
            textColor: '#e5eefb',
            buttonBackground: '#60a5fa',
            buttonTextColor: '#0f172a',
            buttonProgressBackground: 'rgba(191, 219, 254, 0.7)'
        };
    }

    return {
        bannerBackground: 'rgba(255, 248, 235, 0.84)',
        textBackground: 'rgba(255, 255, 255, 0.55)',
        borderColor: 'rgba(15, 23, 42, 0.12)',
        textColor: '#1f2937',
        buttonBackground: '#1d4ed8',
        buttonTextColor: '#ffffff',
        buttonProgressBackground: 'rgba(59, 130, 246, 0.9)'
    };
}

function showRestoreBanner(timeoutSeconds: number, closedTabTitle?: string): void {
    hideRestoreBanner();

    const themeStyles = getBannerThemeStyles();

    const banner = document.createElement('div');
    banner.id = 'back-as-close-restore-banner';
    banner.style.cssText = [
        'position: fixed',
        'top: 20px',
        'left: 50%',
        'transform: translateX(-50%)',
        'display: flex',
        'align-items: center',
        'gap: 12px',
        'max-width: min(680px, calc(100vw - 24px))',
        'padding: 12px 14px',
        `border: 1px solid ${themeStyles.borderColor}`,
        'border-radius: 12px',
        `background: ${themeStyles.bannerBackground}`,
        `color: ${themeStyles.textColor}`,
        'box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18)',
        'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        'font-size: 14px',
        'line-height: 1.4',
        'z-index: 2147483647'
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = [
        'flex: 1',
        'min-width: 0',
        'display: flex',
        'align-items: baseline',
        'gap: 6px',
        'padding: 6px 10px',
        'border-radius: 8px',
        `background: ${themeStyles.textBackground}`
    ].join(';');

    const textPrefix = document.createElement('span');
    textPrefix.textContent = '已关闭标签页：';

    const textTitle = document.createElement('span');
    textTitle.textContent = getCompactTitle(closedTabTitle);
    textTitle.title = closedTabTitle || '未知页面';
    textTitle.style.cssText = [
        'font-weight: 600',
        'max-width: 360px',
        'overflow: hidden',
        'text-overflow: ellipsis',
        'white-space: nowrap'
    ].join(';');

    text.append(textPrefix, textTitle);

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.style.cssText = [
        'position: relative',
        'overflow: hidden',
        'border: 0',
        'border-radius: 999px',
        `background: ${themeStyles.buttonBackground}`,
        `color: ${themeStyles.buttonTextColor}`,
        'padding: 8px 14px',
        'font: inherit',
        'font-weight: 600',
        'cursor: pointer',
        'white-space: nowrap'
    ].join(';');

    const restoreButtonProgress = document.createElement('span');
    restoreButtonProgress.style.cssText = [
        'position: absolute',
        'left: 0',
        'top: 0',
        'height: 100%',
        'width: 100%',
        `background: ${themeStyles.buttonProgressBackground}`,
        'transform-origin: left center',
        'transform: scaleX(1)',
        'pointer-events: none',
        'z-index: 0'
    ].join(';');

    const restoreButtonLabel = document.createElement('span');
    restoreButtonLabel.style.cssText = [
        'position: relative',
        'z-index: 1'
    ].join(';');
    restoreButtonLabel.textContent = '恢复';

    restoreButton.append(restoreButtonProgress, restoreButtonLabel);

    const totalMs = timeoutSeconds * 1000;
    const deadline = Date.now() + totalMs;

    const updateButtonCountdown = (): void => {
        const remainingMs = Math.max(0, deadline - Date.now());
        const ratio = totalMs > 0 ? remainingMs / totalMs : 0;

        restoreButtonProgress.style.transform = `scaleX(${ratio})`;
    };

    updateButtonCountdown();
    restoreBannerCountdownIntervalId = window.setInterval(updateButtonCountdown, 100);

    restoreButton.addEventListener('click', () => {
        void chrome.runtime.sendMessage(createRestoreTabMessage())
            .then((response) => {
                if (response?.action === 'restore-tab') {
                    hideRestoreBanner();
                }
            })
            .catch((error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logDebug('Failed to restore tab from banner action.', { error: errorMessage });
            });
    });

    banner.append(text, restoreButton);
    document.documentElement.appendChild(banner);
    restoreBannerElement = banner;
    restoreBannerTimerId = window.setTimeout(() => hideRestoreBanner(), timeoutSeconds * 1000);
}

function isShowRestoreBannerMessage(message: unknown): message is ShowRestoreBannerMessage {
    return !!message && typeof message === 'object' &&
        (message as Partial<ShowRestoreBannerMessage>).type === MESSAGE_TYPES.SHOW_RESTORE_BANNER &&
        typeof (message as Partial<ShowRestoreBannerMessage>).timeoutSeconds === 'number';
}

function isHideRestoreBannerMessage(message: unknown): message is HideRestoreBannerMessage {
    return !!message && typeof message === 'object' &&
        (message as Partial<HideRestoreBannerMessage>).type === MESSAGE_TYPES.HIDE_RESTORE_BANNER;
}

async function handleBackIntent(): Promise<void> {
    if (pageUnloading) {
        logDebug('Ignoring back because page is unloading.');
        return;
    }

    const prevPage = window.location.href;
    logDebug('Handling back intent.', { currentUrl: prevPage });
    window.history.back();

    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    const currentUrl = window.location.href;
    logDebug('Back navigation attempt completed.', { currentUrl });

    if (currentUrl === prevPage) {
        try {
            logDebug('No history entry to go back to, sending CLOSE_TAB message.');
            await chrome.runtime.sendMessage(createCloseTabMessage());
            logDebug('Tab close triggered, waiting for background reminder.');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logDebug('Error sending CLOSE_TAB message.', { error: errorMessage });
        }
    }
}

async function handleForwardIntent(): Promise<void> {
    if (pageUnloading) {
        logDebug('Ignoring forward because page is unloading.');
        return;
    }

    logDebug('Handling forward intent.');

    try {
        const response = await chrome.runtime.sendMessage(createTryRestoreMessage());

        if (response?.action === 'restore-tab' && response.restoredUrl) {
            logDebug('Restore available, restoring tab.');
            hideRestoreBanner();
            return;
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('Error checking restore availability.', { error: errorMessage });
    }

    logDebug('No restore available, performing normal forward.');
    window.history.forward();
}

function handleBackMouseEvent(event: MouseEvent): void {
    if (event.button !== 3) {
        return;
    }

    logDebug('Captured mouse back event.', {
        eventType: event.type,
        button: event.button,
        buttons: event.buttons
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    void handleBackIntent();
}

function handleForwardMouseEvent(event: MouseEvent): void {
    if (event.button !== 4) {
        return;
    }

    logDebug('Captured mouse forward event.', {
        eventType: event.type,
        button: event.button,
        buttons: event.buttons
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    void handleForwardIntent();
}

function handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT');
    const isBackShortcut = event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft');
    const isForwardShortcut = event.key === 'BrowserForward' || (event.altKey && event.key === 'ArrowRight');

    if (isBackShortcut && !isEditable) {
        logDebug('Captured keyboard back shortcut.', {
            key: event.key,
            altKey: event.altKey
        });
        event.preventDefault();
        event.stopImmediatePropagation();
        void handleBackIntent();
        return;
    }

    if (isForwardShortcut && !isEditable) {
        logDebug('Captured keyboard forward shortcut.', {
            key: event.key,
            altKey: event.altKey
        });
        event.preventDefault();
        event.stopImmediatePropagation();
        void handleForwardIntent();
    }
}

export function main(): void {
    chrome.runtime.onMessage.addListener((message: unknown) => {
        if (isShowRestoreBannerMessage(message)) {
            showRestoreBanner(message.timeoutSeconds, message.closedTabTitle);
            return false;
        }

        if (isHideRestoreBannerMessage(message)) {
            hideRestoreBanner();
            return false;
        }

        return false;
    });

    window.addEventListener('auxclick', (event) => {
        if ((event as MouseEvent).button === 3) {
            handleBackMouseEvent(event as MouseEvent);
        } else if ((event as MouseEvent).button === 4) {
            handleForwardMouseEvent(event as MouseEvent);
        }
    }, true);

    window.addEventListener('keydown', handleKeyDown, true);

    window.addEventListener('beforeunload', () => {
        pageUnloading = true;
        logDebug('Page unloading detected. Stopping event handling.');
    });

    logDebug('Content script initialized (back+forward via auxclick/keyboard).');
}
