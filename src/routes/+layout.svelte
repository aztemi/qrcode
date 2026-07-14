<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  import UpdateAvailable from '$lib/components/UpdateAvailable.svelte';
  import { initInstallPrompt } from '$lib/pwa/install.svelte';

  let { children } = $props();

  const { needRefresh, updateServiceWorker } = useRegisterSW();

  onMount(() => {
    if (!browser) return;
    initInstallPrompt();
  });
</script>

<svelte:head>
  <link rel="icon" href="/icon-192.svg" />
</svelte:head>

<div class="h-dvh flex flex-col overflow-hidden bg-background text-foreground">
  <InstallPrompt />
  <UpdateAvailable {needRefresh} {updateServiceWorker} />
  {@render children()}
</div>
