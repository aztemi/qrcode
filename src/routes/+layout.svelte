<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  import { initInstallPrompt } from '$lib/pwa/install.svelte';

  let { children } = $props();

  onMount(() => {
    if (!browser) return;
    // Set up PWA install handling (beforeinstallprompt / appinstalled / display-mode)
    initInstallPrompt();
  });

  // Register the service worker eagerly (not deferred to `load`) so it activates
  // before offline navigations. iOS Safari launches the installed PWA with a
  // network fetch for start_url — if the SW isn't yet controlling the page,
  // there's nothing to fall back to the cached shell and you get an offline error.
  if (browser && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => console.warn('SW registration failed:', err));
  }
</script>

<svelte:head>
  <link rel="icon" href="/icon-192.svg" />
</svelte:head>

<div class="h-dvh flex flex-col overflow-hidden bg-background text-foreground">
  <InstallPrompt />
  {@render children()}
</div>
