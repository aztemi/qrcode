<script lang="ts">
  import type { Writable } from 'svelte/store';
  import { Button } from '$lib/components/ui/button';
  import { RefreshCw, X as XIcon } from '@lucide/svelte';

  let {
    needRefresh,
    updateServiceWorker
  }: {
    needRefresh: Writable<boolean>;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  } = $props();

  let dismissed = $state(false);

  function handleRefresh() {
    updateServiceWorker();
  }
</script>

{#if $needRefresh && !dismissed}
  <div role="status" aria-label="Update available" class="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in-0 duration-300">
    <div class="flex items-center gap-3 p-3 rounded-xl border bg-card text-card-foreground shadow-lg">
      <div class="hidden sm:flex shrink-0 size-9 rounded-lg bg-primary text-primary-foreground items-center justify-center">
        <RefreshCw class="size-4" aria-hidden="true" />
      </div>

      <div class="min-w-0">
        <p class="text-sm font-medium leading-snug">New version available</p>
        <p class="text-xs text-muted-foreground mt-0.5 leading-snug">Refresh to get the latest updates.</p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <Button size="sm" onclick={handleRefresh}>Refresh</Button>
        <button
          type="button"
          onclick={() => (dismissed = true)}
          class="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Dismiss update notification"
        >
          <XIcon class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
{/if}
