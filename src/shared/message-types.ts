export const MESSAGE_TYPES = {
    CLOSE_TAB: 'CLOSE_TAB',
    TRY_RESTORE: 'TRY_RESTORE',
    RESTORE_TAB: 'RESTORE_TAB',
    SHOW_RESTORE_BANNER: 'SHOW_RESTORE_BANNER',
    HIDE_RESTORE_BANNER: 'HIDE_RESTORE_BANNER'
} as const;

export type CloseTabMessage = {
    type: typeof MESSAGE_TYPES.CLOSE_TAB;
};

export type TryRestoreMessage = {
    type: typeof MESSAGE_TYPES.TRY_RESTORE;
};

export type RestoreTabMessage = {
    type: typeof MESSAGE_TYPES.RESTORE_TAB;
};

export type ShowRestoreBannerMessage = {
    type: typeof MESSAGE_TYPES.SHOW_RESTORE_BANNER;
    timeoutSeconds: number;
    closedTabTitle?: string;
};

export type HideRestoreBannerMessage = {
    type: typeof MESSAGE_TYPES.HIDE_RESTORE_BANNER;
};

export type Message =
    | CloseTabMessage
    | TryRestoreMessage
    | RestoreTabMessage
    | ShowRestoreBannerMessage
    | HideRestoreBannerMessage;

export type WorkerResponse = {
    handled: boolean;
    action?: 'close-tab' | 'restore-tab' | 'no-restore';
    error?: string;
    restoredUrl?: string;
};

export function createCloseTabMessage(): CloseTabMessage {
    return { type: MESSAGE_TYPES.CLOSE_TAB };
}

export function createTryRestoreMessage(): TryRestoreMessage {
    return { type: MESSAGE_TYPES.TRY_RESTORE };
}

export function createRestoreTabMessage(): RestoreTabMessage {
    return { type: MESSAGE_TYPES.RESTORE_TAB };
}

export function createShowRestoreBannerMessage(
    timeoutSeconds: number,
    closedTabTitle?: string
): ShowRestoreBannerMessage {
    return {
        type: MESSAGE_TYPES.SHOW_RESTORE_BANNER,
        timeoutSeconds,
        closedTabTitle
    };
}

export function createHideRestoreBannerMessage(): HideRestoreBannerMessage {
    return { type: MESSAGE_TYPES.HIDE_RESTORE_BANNER };
}

export function isBackAsCloseMessage(message: unknown): message is Message {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const candidate = message as Partial<Message>;
    return (
        candidate.type === MESSAGE_TYPES.CLOSE_TAB ||
        candidate.type === MESSAGE_TYPES.TRY_RESTORE ||
        candidate.type === MESSAGE_TYPES.RESTORE_TAB ||
        candidate.type === MESSAGE_TYPES.SHOW_RESTORE_BANNER ||
        candidate.type === MESSAGE_TYPES.HIDE_RESTORE_BANNER
    );
}