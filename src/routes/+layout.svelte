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
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => console.warn('SW registration failed:', err));
      });
    }
  });
</script>

<svelte:head>
  <link rel="icon" href="/icon-192.svg" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-background text-foreground">
  <InstallPrompt />
  {@render children()}
</div>
