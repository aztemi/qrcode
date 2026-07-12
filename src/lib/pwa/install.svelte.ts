// PWA install state. Captures `beforeinstallprompt`, tracks install status,
// and persists "don't show again" preferences to localStorage so we never nag.

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'pwa:install-dismissed';
const DISMISS_DURATION = 1000 * 60 * 60 * 24 * 14; // 14 days before re-prompting

let deferred = $state<BeforeInstallPromptEvent | null>(null);
let isInstalled = $state(false);
let dismissedAt = $state<number | null>(null);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari exposes navigator.standalone
    (typeof navigator !== 'undefined' && 'standalone' in navigator && navigator.standalone === true)
  );
}

function isiOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWebkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isWebkit;
}

function setDismissed() {
  dismissedAt = Date.now();
  try {
    localStorage.setItem(DISMISS_KEY, String(dismissedAt));
  } catch {
    // ignore storage errors (private mode, disabled cookies)
  }
}

// Public reactive state accessors
export const installState = {
  get canInstall() {
    return deferred !== null;
  },
  get isInstalled() {
    return isInstalled;
  },
  // Android/Chrome: native prompt available
  get hasPrompt() {
    return deferred !== null;
  },
  // iOS Safari: no prompt event, must show manual instructions
  get needsManualHint() {
    return !isInstalled && !deferred && isiOSSafari();
  },
  // Show banner only if: not installed, not dismissed recently, and either
  // we have a native prompt OR we're on iOS Safari (manual hint path)
  get shouldShow() {
    if (isInstalled) return false;
    if (dismissedAt !== null && Date.now() - dismissedAt < DISMISS_DURATION) return false;
    return deferred !== null || isiOSSafari();
  }
};

export function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return Promise.resolve('unavailable');
  const event = deferred;
  deferred = null;
  return event.prompt().then(async () => {
    const choice = await event.userChoice;
    if (choice.outcome === 'dismissed') setDismissed();
    return choice.outcome;
  });
}

export function dismissInstall() {
  setDismissed();
  // Also drop a pending prompt so the UI hides immediately; the banner won't
  // reappear for DISMISS_DURATION. If the user revisits later and Chrome
  // re-fires beforeinstallprompt, deferred gets repopulated and the banner
  // re-evaluates against the dismissal window.
  deferred = null;
}

export function initInstallPrompt() {
  if (typeof window === 'undefined') return;

  // Load persisted dismissal
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) dismissedAt = Number(stored) || null;
  } catch {
    // ignore
  }

  // Detect already-installed state (standalone display or app was launched as PWA)
  isInstalled = isStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the default browser mini-infobar to avoid double-prompting
    e.preventDefault();
    // Only hold onto the prompt if the user hasn't recently dismissed our banner
    if (dismissedAt !== null && Date.now() - dismissedAt < DISMISS_DURATION) return;
    deferred = e as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferred = null;
    // Persist installed so we don't show hints after install
    try {
      localStorage.setItem(DISMISS_KEY, '');
    } catch {
      // ignore
    }
  });

  // Update display-mode reactively (covers user manually adding to home screen later)
  window.matchMedia('(display-mode: standalone)').addEventListener('change', ev => {
    if (ev.matches) {
      isInstalled = true;
      deferred = null;
    }
  });
}
