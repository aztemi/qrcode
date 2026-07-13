<script lang="ts">
  // Non-aggressive PWA install prompt. Two paths:
  // 1. Chromium/Android: capture beforeinstallprompt, show "Install" button.
  // 2. iOS Safari: no prompt event; show manual "Add to Home Screen" steps.
  //
  // UX guidelines followed:
  // - Never blocks the main flow (inline, dismissible).
  // - Persists dismissal for 14 days — no nagging on every page load.
  // - Requires meaningful engagement before prompting: at least 1 user tap/click
  //   AND at least 30 seconds on page — ~80% of installs happen after engagement.
  // - Clear primary action, clear dismiss control, respects prefers-reduced-motion.

  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { Button } from '$lib/components/ui/button';
  import { installState, dismissInstall, promptInstall } from '$lib/pwa/install.svelte';
  import { Download, X as XIcon, Share, PlusSquare, ChevronRight, LoaderCircle } from '@lucide/svelte';

  let visible = $state(false);
  let iosStepsOpen = $state(false);
  let prompting = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let checkTimer: ReturnType<typeof setInterval> | null = null;

  const MIN_VIEW_TIME = 30_000;
  let pageLoadTime = 0;
  let hasInteracted = false;

  function isEligible() {
    return hasInteracted && Date.now() - pageLoadTime >= MIN_VIEW_TIME;
  }

  function evaluateVisibility() {
    if (!browser) return;
    if (!installState.isInstalled && isEligible() && installState.shouldShow) {
      visible = true;
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }
    }
  }

  function handleInteraction() {
    if (hasInteracted) return;
    hasInteracted = true;
    // User just interacted — start polling for the time gate.
    if (!checkTimer) {
      checkTimer = setInterval(evaluateVisibility, 1000);
    }
  }

  onMount(() => {
    if (!browser) return;
    pageLoadTime = Date.now();
    document.addEventListener('click', handleInteraction, { once: true });
    // Schedule the first eligibility check after the time gate.
    timer = setTimeout(evaluateVisibility, MIN_VIEW_TIME);
  });

  onDestroy(() => {
    if (timer) clearTimeout(timer);
    if (checkTimer) clearInterval(checkTimer);
  });

  async function handleInstall() {
    if (prompting) return;
    prompting = true;
    try {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        // Fallback to iOS-style instructions if somehow no prompt
        iosStepsOpen = true;
      } else {
        visible = false;
      }
    } finally {
      prompting = false;
    }
  }

  function handleDismiss() {
    dismissInstall();
    visible = false;
  }

  // Reactivity: anytime installState.shouldShow changes (e.g. a new
  // beforeinstallprompt arrives), refresh visibility — but only if engagement
  // gates are already satisfied.
  $effect(() => {
    if (!browser) return;
    // Touch the reactive state so this re-runs on change.
    const _should = installState.shouldShow;
    const _can = installState.canInstall;
    // Don't override a just-dismissed banner; only show if engagement met.
    if (_should && !installState.isInstalled && isEligible()) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        visible = true;
      }, 200);
    }
  });
</script>

{#if visible}
  <div
    role="dialog"
    aria-label="Install app"
    class="container mx-auto max-w-[1000px] px-4 pt-3 animate-in slide-in-from-top-2 fade-in-0 duration-300"
  >
    <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
      <div class="hidden sm:flex shrink-0 size-10 rounded-lg bg-primary text-primary-foreground items-center justify-center">
        <Download class="size-5" aria-hidden="true" />
      </div>

      <div class="flex-1 min-w-0">
        {#if installState.hasPrompt}
          <!-- Chromium / Android: native install prompt path -->
          {#if !iosStepsOpen}
            <p class="text-sm font-medium leading-snug">Install QR Code</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-snug">Scan and create QR codes faster from your home screen.</p>
            <div class="mt-2.5 flex items-center gap-2">
              <Button size="sm" onclick={handleInstall} disabled={prompting}>
                {#if prompting}
                  <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
                {/if}
                Install
              </Button>
              <Button size="sm" variant="ghost" onclick={handleDismiss}>Not now</Button>
            </div>
          {/if}
        {:else if installState.needsManualHint}
          <!-- iOS Safari manual install -->
          <p class="text-sm font-medium leading-snug">Add QR Code to your Home Screen</p>
          <p class="text-xs text-muted-foreground mt-0.5 leading-snug">Works offline, just like an app.</p>
          {#if !iosStepsOpen}
            <div class="mt-2.5 flex items-center gap-2">
              <Button size="sm" onclick={() => (iosStepsOpen = true)}>Show me how</Button>
              <Button size="sm" variant="ghost" onclick={handleDismiss}>Not now</Button>
            </div>
          {:else}
            <ol class="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
              <li class="flex items-center gap-2">
                <Share class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>Tap the <strong class="text-foreground font-semibold">Share</strong> button in Safari's toolbar.</span>
              </li>
              <li class="flex items-center gap-2">
                <PlusSquare class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>Choose <strong class="text-foreground font-semibold">Add to Home Screen</strong>.</span>
              </li>
              <li class="flex items-center gap-2">
                <ChevronRight class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>Tap <strong class="text-foreground font-semibold">Add</strong> — that's it.</span>
              </li>
            </ol>
            <div class="mt-2.5">
              <Button size="sm" variant="ghost" onclick={handleDismiss}>Got it</Button>
            </div>
          {/if}
        {/if}
      </div>

      <button
        type="button"
        onclick={handleDismiss}
        class="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Dismiss install prompt"
      >
        <XIcon class="size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
{/if}
