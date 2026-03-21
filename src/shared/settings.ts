export const SETTINGS_KEYS = {
    RESTORE_TIMEOUT_SECONDS: 'restoreTimeoutSeconds'
} as const;

export const DEFAULT_SETTINGS = {
    RESTORE_TIMEOUT_SECONDS: 3
} as const;

export const SETTINGS_CONSTRAINTS = {
    RESTORE_TIMEOUT_MIN: 1,
    RESTORE_TIMEOUT_MAX: 60
} as const;

export interface Settings {
    restoreTimeoutSeconds: number;
}

export async function loadSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get({
        [SETTINGS_KEYS.RESTORE_TIMEOUT_SECONDS]: DEFAULT_SETTINGS.RESTORE_TIMEOUT_SECONDS
    });

    return {
        restoreTimeoutSeconds: result[SETTINGS_KEYS.RESTORE_TIMEOUT_SECONDS] as number
    };
}
