import {
    DEFAULT_SETTINGS,
    loadSettings,
    SETTINGS_KEYS,
    SETTINGS_CONSTRAINTS
} from './shared/settings.js';

const input = document.getElementById('restore-timeout') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

let statusTimerId: number | undefined;

function showStatus(text: string, type: 'success' | 'error'): void {
    if (statusTimerId !== undefined) {
        clearTimeout(statusTimerId);
    }

    statusEl.textContent = text;
    statusEl.className = type;

    statusTimerId = window.setTimeout(() => {
        statusEl.className = 'hidden';
    }, 2500);
}

function validate(): boolean {
    const value = input.valueAsNumber;
    const valid =
        Number.isInteger(value) &&
        value >= SETTINGS_CONSTRAINTS.RESTORE_TIMEOUT_MIN &&
        value <= SETTINGS_CONSTRAINTS.RESTORE_TIMEOUT_MAX;

    input.classList.toggle('invalid', !valid);
    return valid;
}

async function init(): Promise<void> {
    input.placeholder = String(DEFAULT_SETTINGS.RESTORE_TIMEOUT_SECONDS);

    const settings = await loadSettings();
    input.value = String(settings.restoreTimeoutSeconds);
}

input.addEventListener('input', () => validate());

saveButton.addEventListener('click', async () => {
    if (!validate()) {
        showStatus(
            `Please enter a value between ${SETTINGS_CONSTRAINTS.RESTORE_TIMEOUT_MIN} and ${SETTINGS_CONSTRAINTS.RESTORE_TIMEOUT_MAX}.`,
            'error'
        );
        return;
    }

    try {
        await chrome.storage.sync.set({
            [SETTINGS_KEYS.RESTORE_TIMEOUT_SECONDS]: input.valueAsNumber
        });
        showStatus('Settings saved.', 'success');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        showStatus(`Failed to save: ${message}`, 'error');
    }
});

void init();
