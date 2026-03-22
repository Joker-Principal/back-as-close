import {
    createCloseTabMessage,
    createRestoreTabMessage,
    createTryRestoreMessage,
    MESSAGE_TYPES,
    type HideRestoreBannerMessage,
    type ShowRestoreBannerMessage
} from './shared/message-types.js';

const LOG_PREFIX = '[BackAsClose][Content]';

let pageUnloading = false;
let restoreBannerElement: HTMLDivElement | null = null;
let restoreBannerTimerId: number | null = null;
let restoreBannerCountdownIntervalId: number | null = null;
let backNavigationTimerId: number | null = null;

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
                console.debug(`${LOG_PREFIX} Failed to restore tab from banner action.`, { at: new Date().toISOString(), error: errorMessage });
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
    backNavigationTimerId = window.setTimeout(() => {
        console.debug(`${LOG_PREFIX} Back navigation timeout reached.`);
        chrome.runtime.sendMessage(createCloseTabMessage(), (response) => {});
    }, 100);
}

async function handleForwardIntent(): Promise<void> {
    if (pageUnloading) {
        console.debug(`${LOG_PREFIX} Ignoring forward because page is unloading.`);
        return;
    }

    console.debug(`${LOG_PREFIX} Handling forward intent.`);

    try {
        const response = await chrome.runtime.sendMessage(createTryRestoreMessage());

        if (response?.action === 'restore-tab' && response.restoredUrl) {
            console.debug(`${LOG_PREFIX} Restore available, restoring tab.`);
            hideRestoreBanner();
            return;
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.debug(`${LOG_PREFIX} Error checking restore availability.`, { at: new Date().toISOString(), error: errorMessage });
    }

    console.debug(`${LOG_PREFIX} No restore available, performing normal forward.`);
}

function handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT');

    if(isEditable) return;
    
    const isBackShortcut = event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft');
    const isForwardShortcut = event.key === 'BrowserForward' || (event.altKey && event.key === 'ArrowRight');

    if (isBackShortcut) {
        console.debug(`${LOG_PREFIX} Captured keyboard back shortcut.`, {
            at: new Date().toISOString(),
            key: event.key,
            altKey: event.altKey
        });
        void handleBackIntent();
    }
    else if (isForwardShortcut) {
        console.debug(`${LOG_PREFIX} Captured keyboard forward shortcut.`, {
            at: new Date().toISOString(),
            key: event.key,
            altKey: event.altKey
        });
        void handleForwardIntent();
    }
    else {
        return;
    }
}

function handleAuxClick(event: MouseEvent): void {
    if (event.button === 3) {
        console.debug(`${LOG_PREFIX} Captured mouse back event.`, {
            at: new Date().toISOString(),
            eventType: event.type,
            button: event.button,
            buttons: event.buttons
        });
        void handleBackIntent();
    } else if (event.button === 4) {
        console.debug(`${LOG_PREFIX} Captured mouse forward event.`, {
            at: new Date().toISOString(),
            eventType: event.type,
            button: event.button,
            buttons: event.buttons
        });
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

    window.addEventListener('auxclick', handleAuxClick, true);

    window.addEventListener('keydown', handleKeyDown, true);

    window.addEventListener('popstate', (event: PopStateEvent) => {
        console.debug(`${LOG_PREFIX} popstate event detected.`, { at: new Date().toISOString(), state: event.state });
        if(backNavigationTimerId)
        {
            window.clearTimeout(backNavigationTimerId);
            backNavigationTimerId = null;
        }
    });

    window.addEventListener('beforeunload', () => {
        console.debug(`${LOG_PREFIX} Page unloading detected. Stopping event handling.`);
        pageUnloading = true;
        if(backNavigationTimerId)
        {
            window.clearTimeout(backNavigationTimerId);
            backNavigationTimerId = null;
        }
    });

    console.debug(`${LOG_PREFIX} Content script initialized (back+forward via auxclick/keyboard).`);
}
