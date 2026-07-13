<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { cn } from '$lib/utils';
  import { version } from '../../package.json';

  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { Switch } from '$lib/components/ui/switch';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '$lib/components/ui/dialog';

  import { installState, promptInstall } from '$lib/pwa/install.svelte';

  import {
    QrCode,
    Camera,
    History,
    Settings,
    Info,
    Download,
    Copy,
    Share2,
    Trash2,
    Sun,
    Moon,
    Monitor,
    Wifi,
    Mail,
    Phone,
    MapPin,
    Link2,
    LoaderCircle,
    PlusSquare,
    ChevronRight,
    Check,
    X as XIcon,
    Image,
    ImageUp,
    FileText,
    Eye,
    MessageSquare,
    Upload,
    User,
    RefreshCw
  } from '@lucide/svelte';

  import QRCode from 'qrcode';
  import { Html5Qrcode } from 'html5-qrcode';

  // Types
  type Tab = 'scan' | 'create' | 'history' | 'settings';
  type QRType = 'url' | 'text' | 'wifi' | 'email' | 'phone' | 'sms' | 'location' | 'contact';

  type HistoryItem = {
    id: string;
    type: 'scan' | 'create';
    content: string;
    qrType?: QRType;
    timestamp: number;
    dataUrl?: string;
  };

  type Settings = {
    theme: 'light' | 'dark' | 'system';
    showHistory: boolean;
    vibration: boolean;
    sound: boolean;
  };

  // State
  let activeTab = $state<Tab>('scan');
  let settings = $state<Settings>({
    theme: 'system',
    showHistory: true,
    vibration: true,
    sound: true
  });

  let history = $state<HistoryItem[]>([]);
  let isScanning = $state(false);
  let scanResult = $state<string | null>(null);
  let html5Qrcode = $state<Html5Qrcode | null>(null);
  let selectedCameraId = $state<string | null>(null);
  let cameras = $state<MediaDeviceInfo[]>([]);
  let audioCtx: AudioContext | null = null;
  let isScanningFile = $state(false);
  let copiedId = $state<string | null>(null);
  let scanError = $state<string | null>(null);
  // Create tab state
  let qrType = $state<QRType>('url');
  let qrInput = $state('');
  let qrDataUrl = $state<string | null>(null);
  let qrColor = $state('#000000');
  let qrBgColor = $state('#ffffff');
  let qrSize = $state(256);
  let qrMargin = $state(4);
  let isGenerating = $state(false);
  let showQrDialog = $state(false);
  let generatedQrDataUrl = $state<string | null>(null);

  let showInstallDialog = $state(false);
  let isInstalling = $state(false);

  // Structured form fields
  let wifiSsid = $state('');
  let wifiPassword = $state('');
  let wifiEncryption = $state('WPA');
  let wifiHidden = $state(false);
  let emailTo = $state('');
  let emailSubject = $state('');
  let emailBody = $state('');
  let smsNumber = $state('');
  let smsMessage = $state('');
  let locLat = $state('');
  let locLng = $state('');
  let locating = $state(false);
  let contactName = $state('');
  let contactPhone = $state('');
  let contactEmail = $state('');
  let contactOrg = $state('');
  let contactUrl = $state('');

  // Animation states
  let scanAnimation = $state(false);
  let createAnimation = $state(false);

  // footer
  const year = new Date().getFullYear();

  // Initialize
  onMount(() => {
    if (!browser) return;

    // Load settings
    const savedSettings = localStorage.getItem('qr_settings');
    if (savedSettings) {
      try {
        settings = { ...settings, ...JSON.parse(savedSettings) };
      } catch {}
    }

    // Load history
    const savedHistory = localStorage.getItem('qr_history');
    if (savedHistory) {
      try {
        history = JSON.parse(savedHistory);
      } catch {}
    }

    // Apply theme
    applyTheme(settings.theme);

    // Get cameras (try getUserMedia first for permission, then enumerate)
    requestCameraAndEnumerate();
  });

  onDestroy(() => {
    stopScanning();
    audioCtx?.close().catch(() => {});
  });

  function applyTheme(theme: Settings['theme']) {
    if (!browser) return;
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }

  function saveSettings() {
    if (!browser) return;
    localStorage.setItem('qr_settings', JSON.stringify(settings));
    applyTheme(settings.theme);
  }

  function saveHistory() {
    if (!browser || !settings.showHistory) return;
    localStorage.setItem('qr_history', JSON.stringify(history.slice(0, 100)));
  }

  async function getCameras() {
    if (!browser) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length > 0 && !selectedCameraId) {
        const back = cameras.find(c => /back|rear|environment/i.test(c.label));
        selectedCameraId = (back ?? cameras[cameras.length - 1]).deviceId;
      }
    } catch (e) {
      console.error('Failed to get cameras:', e);
    }
  }

  // On mount we only enumerateDevices() (transport-only, no permission
  // prompt). We request camera permission lazily on the first startScanning()
  // call (user-initiated), so iOS Safari does not re-prompt on every reload.
  function hasRealCameras() {
    return cameras.length > 0 && cameras.every(c => c.label && c.label.length > 0);
  }

  async function requestCameraAndEnumerate() {
    if (!browser) return;
    await getCameras();
  }

  async function scanImageFile(file: File) {
    if (!browser || isScanningFile) return;

    isScanningFile = true;
    scanResult = null;

    try {
      const qrCode = new Html5Qrcode('qr-reader-temp');
      const result = await qrCode.scanFileV2(file, false);

      onScanSuccess(result.decodedText);
      qrCode.clear();
    } catch {
      scanResult = null;
    } finally {
      isScanningFile = false;
    }
  }

  function triggerFileInput() {
    const input = document.getElementById('qr-file-input') as HTMLInputElement;
    input?.click();
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      scanImageFile(file);
      input.value = '';
    }
  }

  function ensureAudioCtx() {
    if (!browser) return;
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    }
    // A user gesture just happened; resume if suspended.
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  async function startScanning() {
    if (!browser || isScanning) return;

    // Warm up AudioContext on the user gesture (Start tap) so the first
    // scan beep is audible.
    ensureAudioCtx();

    try {
      isScanning = true;
      scanAnimation = true;
      scanResult = null;
      scanError = null;

      // Ensure we have a real deviceId with permission granted.
      // On iOS Safari, getUserMedia() permission is not reliably persisted
      // across reloads, so we trigger it here on user intent rather than
      // at mount time.
      if (!selectedCameraId || !hasRealCameras()) {
        try {
          const tmpStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          });
          // Pull a real deviceId from the granted track
          const track = tmpStream.getVideoTracks()[0];
          const settings = track.getSettings();
          if (settings.deviceId) selectedCameraId = settings.deviceId;
          // Refresh labels/deviceIds now that permission is granted
          tmpStream.getTracks().forEach(t => t.stop());
          await getCameras();
          if (!selectedCameraId && cameras.length > 0) {
            const back = cameras.find(c => /back|rear|environment/i.test(c.label));
            selectedCameraId = (back ?? cameras[cameras.length - 1]).deviceId;
          }
        } catch (e) {
          // Expected on devices with no camera (NotFoundError) or when the
          // user denies permission (NotAllowedError/SecurityError). Surface a
          // friendly message instead of a noisy console error.
          let reason = 'Camera unavailable.';
          if (e instanceof DOMException) {
            if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
              reason = 'No camera found on this device.';
            } else if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
              reason = 'Camera permission denied.';
            }
          }
          console.warn(reason, e);
          scanError = reason;
          isScanning = false;
          scanAnimation = false;
          return;
        }
      }

      if (!selectedCameraId) {
        isScanning = false;
        scanAnimation = false;
        return;
      }

      html5Qrcode = new Html5Qrcode('qr-reader');

      await html5Qrcode.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText: string) => {
          onScanSuccess(decodedText);
        },
        (error: string) => {
          // Ignore scan errors
        }
      );
      await getCameras();
    } catch (err) {
      console.error('Failed to start scanning:', err);
      isScanning = false;
      scanAnimation = false;
    }
  }

  function stopScanning() {
    if (html5Qrcode && isScanning) {
      html5Qrcode.stop().catch(console.error);
      isScanning = false;
      scanAnimation = false;
    }
  }

  async function switchCameraTo(deviceId: string) {
    if (selectedCameraId === deviceId) return;
    selectedCameraId = deviceId;
    if (isScanning) {
      stopScanning();
      await tick();
      await startScanning();
    }
  }

  async function switchCamera() {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex(c => c.deviceId === selectedCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    await switchCameraTo(next.deviceId);
  }

  function onScanSuccess(text: string) {
    scanResult = text;
    scanAnimation = false;

    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(100);
    }

    if (settings.sound) {
      // Play a subtle beep using the shared (already-running) context
      const ctx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioCtx) audioCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => osc.stop(), 100);
    }

    stopScanning();

    // Add to history
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      type: 'scan',
      content: text,
      timestamp: Date.now()
    };
    history = [item, ...history];
    saveHistory();
  }

  // Check if any required structured field is missing
  function isFormValid(): boolean {
    switch (qrType) {
      case 'url':
      case 'text':
      case 'phone':
        return qrInput.trim().length > 0;
      case 'wifi':
        return wifiSsid.trim().length > 0;
      case 'email':
        return emailTo.trim().length > 0;
      case 'sms':
        return smsNumber.trim().length > 0;
      case 'location':
        return locLat.trim().length > 0 && locLng.trim().length > 0;
      case 'contact':
        return contactName.trim().length > 0;
      default:
        return true;
    }
  }

  async function useMyLocation() {
    if (!browser || !navigator.geolocation || locating) return;
    locating = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        locLat = pos.coords.latitude.toFixed(6);
        locLng = pos.coords.longitude.toFixed(6);
        locating = false;
      },
      _err => {
        locating = false;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function generateQRCode() {
    if (!isFormValid() || isGenerating) return;

    isGenerating = true;
    createAnimation = true;

    try {
      let data = qrInput;

      // Format data based on type, using form fields for structured types
      switch (qrType) {
        case 'wifi': {
          data = `WIFI:T:${wifiEncryption};S:${wifiSsid};P:${wifiEncryption === 'nopass' ? '' : wifiPassword};H:${wifiHidden ? 'true' : 'false'};;`;
          break;
        }
        case 'email': {
          data = `mailto:${emailTo}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ''}${emailBody ? `${emailSubject ? '&' : '?'}body=${encodeURIComponent(emailBody)}` : ''}`;
          break;
        }
        case 'phone': {
          data = `tel:${qrInput}`;
          break;
        }
        case 'sms': {
          data = `sms:${smsNumber}${smsMessage ? `?body=${encodeURIComponent(smsMessage)}` : ''}`;
          break;
        }
        case 'location': {
          data = `geo:${locLat},${locLng}`;
          break;
        }
        case 'contact': {
          data = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${contactName}`,
            contactName ? `N:${contactName};;;;` : '',
            contactPhone ? `TEL:${contactPhone}` : '',
            contactEmail ? `EMAIL:${contactEmail}` : '',
            contactOrg ? `ORG:${contactOrg}` : '',
            contactUrl ? `URL:${contactUrl}` : '',
            'END:VCARD'
          ]
            .filter(Boolean)
            .join('\n');
          break;
        }
      }

      const dataUrl = await QRCode.toDataURL(data, {
        width: qrSize,
        margin: qrMargin,
        color: {
          dark: qrColor,
          light: qrBgColor
        },
        errorCorrectionLevel: 'M'
      });

      qrDataUrl = dataUrl;
      generatedQrDataUrl = dataUrl;
      createAnimation = false;

      // Add to history
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        type: 'create',
        content: data,
        qrType,
        timestamp: Date.now(),
        dataUrl
      };
      history = [item, ...history];
      saveHistory();
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      isGenerating = false;
      createAnimation = false;
    }
  }

  function getQRTypeLabel(type: QRType): string {
    const labels: Record<QRType, string> = {
      url: 'URL / Link',
      text: 'Plain Text',
      wifi: 'WiFi Network',
      email: 'Email',
      phone: 'Phone Number',
      sms: 'SMS',
      location: 'Location',
      contact: 'Contact (vCard)'
    };
    return labels[type];
  }

  function getQRTypePlaceholder(type: QRType): string {
    const placeholders: Record<QRType, string> = {
      url: 'https://example.com',
      text: 'Any text content',
      wifi: 'SSID|Password|WPA|false (format: SSID|Password|Encryption|Hidden)',
      email: 'email@example.com|Subject|Body',
      phone: '+1234567890',
      sms: '+1234567890|Message text',
      location: '37.7749|-122.4194|Optional query',
      contact: 'Name|Phone|Email|Organization|Website'
    };
    return placeholders[type];
  }

  function getQRTypeIcon(type: QRType) {
    const icons: Record<QRType, any> = {
      url: Link2,
      text: FileText,
      wifi: Wifi,
      email: Mail,
      phone: Phone,
      sms: MessageSquare,
      location: MapPin,
      contact: User
    };
    return icons[type] || QrCode;
  }

  function formatTimestamp(ts: number): string {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    copiedId = id;
    setTimeout(() => {
      copiedId = null;
    }, 2000);
  }

  async function downloadQRCode() {
    if (!generatedQrDataUrl) return;
    const link = document.createElement('a');
    link.href = generatedQrDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    link.click();
  }

  async function shareQRCode() {
    if (!generatedQrDataUrl || !navigator.share) return;
    try {
      const response = await fetch(generatedQrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `qrcode-${Date.now()}.png`, { type: 'image/png' });
      await navigator.share({ files: [file], title: 'QR Code' });
    } catch (e) {
      console.log('Share cancelled or failed');
    }
  }

  function clearHistory() {
    history = [];
    saveHistory();
  }

  function deleteHistoryItem(id: string) {
    history = history.filter(h => h.id !== id);
    saveHistory();
  }

  async function installApp() {
    if (isInstalling) return;
    if (!installState.hasPrompt) {
      // No native prompt (e.g. iOS Safari) — open the manual instructions dialog
      showInstallDialog = true;
      return;
    }
    isInstalling = true;
    try {
      await promptInstall();
    } finally {
      isInstalling = false;
    }
  }
</script>

<div class="w-full flex flex-col min-h-screen bg-background">
  <!-- Header with Desktop Tabs -->
  <header class="hidden md:block w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="mx-auto max-w-[1000px]">
      <div class="flex h-14 items-center justify-center px-4">
        <h1 class="text-xl font-semibold tracking-tight">QR Code App</h1>
      </div>
    </div>
  </header>

  <!-- Desktop Tabs (top) -->
  <div class="hidden md:block sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
    <div class="mx-auto max-w-[1000px]">
      <div class="flex h-12 justify-center" role="tablist">
        <button
          class={cn(
            'relative flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors',
            activeTab === 'scan' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          onclick={() => (activeTab = 'scan')}
        >
          <Camera class="h-4 w-4" />
          <span>Scan</span>
          {#if activeTab === 'scan'}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
          {/if}
        </button>
        <button
          class={cn(
            'relative flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors',
            activeTab === 'create' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          onclick={() => (activeTab = 'create')}
        >
          <QrCode class="h-4 w-4" />
          <span>Create</span>
          {#if activeTab === 'create'}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
          {/if}
        </button>
        <button
          class={cn(
            'relative flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors',
            activeTab === 'history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          onclick={() => (activeTab = 'history')}
        >
          <History class="h-4 w-4" />
          <span>History</span>
          {#if activeTab === 'history'}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
          {/if}
        </button>
        <button
          class={cn(
            'relative flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors',
            activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          onclick={() => (activeTab = 'settings')}
        >
          <Settings class="h-4 w-4" />
          <span>Settings</span>
          {#if activeTab === 'settings'}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Content -->
  <main class="flex-1 overflow-y-auto p-4 lg:p-6 pb-25 md:pb-6">
    <div class="mx-auto max-w-[1000px]">
      <!-- SCAN TAB -->
      {#if activeTab === 'scan'}
        <div class="animate-in fade-in-0 duration-200">
          <div class="space-y-6 max-w-md mx-auto w-full">
            <!-- Camera Scanner -->
            <Card class="overflow-hidden">
              <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2">
                  <Camera class="h-5 w-5 text-primary" />
                  QR from Camera
                </CardTitle>
              </CardHeader>
              <CardContent class="pt-0">
                <div class="relative overflow-hidden aspect-square max-w-xs mx-auto">
                  <div id="qr-reader" class="w-full h-full"></div>
                  {#if !isScanning}
                    <div
                      class="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 rounded-lg border-2 border-dashed border-border p-4"
                    >
                      <Camera class="h-12 w-12 text-muted-foreground mb-3" />
                      <p class="text-center text-sm {scanError ? 'text-destructive' : 'text-muted-foreground'}">
                        {scanError ? scanError : selectedCameraId ? 'Tap to start scanning' : 'Tap to allow camera access'}
                      </p>
                      <Button class="mt-3" size="lg" onclick={startScanning} disabled={isGenerating}>
                        {#if scanAnimation}
                          <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
                          Starting...
                        {:else}
                          Start Scanning
                        {/if}
                      </Button>
                    </div>
                  {/if}

                  {#if isScanning}
                    <!-- Scan frame overlay -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div class="relative w-[250px] h-[250px]">
                        <div class="absolute inset-0 border-2 border-primary/50 rounded-lg"></div>
                        <!-- Corner brackets -->
                        <div class="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                        <div class="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                        <div class="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                        <div class="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                      </div>
                    </div>

                    <div
                      class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg"
                    >
                      <LoaderCircle class="h-4 w-4 animate-spin text-primary" />
                      <span class="text-sm font-medium">Scanning...</span>
                      {#if cameras.length > 1}
                        <Button variant="ghost" size="icon" onclick={switchCamera}>
                          <RefreshCw class="h-4 w-4" />
                        </Button>
                      {/if}
                      <Button variant="ghost" size="icon" onclick={stopScanning} class="text-destructive">
                        <XIcon class="h-4 w-4" />
                      </Button>
                    </div>
                  {/if}
                </div>

                <!-- Camera Selector -->
                {#if cameras.length > 1}
                  <div class="flex items-center gap-1 pt-6">
                    <Label class="text-sm font-medium">Active Camera</Label>
                    <Select
                      value={selectedCameraId ?? undefined}
                      onValueChange={v => {
                        if (v) switchCameraTo(v);
                      }}
                      type="single"
                    >
                      <SelectTrigger class="w-full">
                        {cameras.find(c => c.deviceId === selectedCameraId)?.label || 'Select camera'}
                      </SelectTrigger>
                      <SelectContent>
                        {#each cameras as camera}
                          <SelectItem value={camera.deviceId}>
                            {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                          </SelectItem>
                        {/each}
                      </SelectContent>
                    </Select>
                  </div>
                {/if}
              </CardContent>
            </Card>

            <!-- Scan Result Actions -->
            {#if scanResult && !isScanning}
              <div
                class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-in slide-in-from-bottom-2 duration-300"
              >
                <div class="flex items-start gap-3">
                  <Check class="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-green-800 dark:text-green-200">QR Code Detected!</p>
                    <p class="text-sm text-green-700 dark:text-green-300 mt-1 break-all">{scanResult}</p>
                    <div class="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onclick={() => copyToClipboard(scanResult!, 'scan-inline')}>
                        {#if copiedId === 'scan-inline'}
                          <Check class="h-3 w-3 mr-1" />
                          Copied!
                        {:else}
                          <Copy class="h-3 w-3 mr-1" />
                          Copy
                        {/if}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => {
                          activeTab = 'history';
                          scanResult = null;
                        }}
                      >
                        <History class="h-3 w-3 mr-1" />
                        View History
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onclick={() => (scanResult = null)}>
                    <XIcon class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            {/if}

            <!-- Scan from Image -->
            <input id="qr-file-input" type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
            <div id="qr-reader-temp" class="hidden"></div>

            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2">
                  <ImageUp class="h-5 w-5 text-primary" />
                  QR from Image
                </CardTitle>
              </CardHeader>
              <CardContent class="pt-0">
                <Button variant="outline" class="w-full" onclick={triggerFileInput} disabled={isScanningFile || isScanning}>
                  {#if isScanningFile}
                    <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
                    Scanning image...
                  {:else}
                    <Upload class="h-4 w-4 mr-2" />
                    Upload an image with QR
                  {/if}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <!-- CREATE TAB -->
      {:else if activeTab === 'create'}
        <div class="space-y-6 max-w-2xl mx-auto w-full">
          <!-- QR Type Selector -->
          <Card>
            <CardHeader class="pb-2">
              <CardTitle class="flex items-center gap-2">
                <QrCode class="h-5 w-5 text-primary" />
                Create QR Code
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="space-y-4">
                <!-- Type Selector -->
                <div>
                  <Label class="text-sm font-medium mb-2 block">QR Code Type</Label>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {#each ['url', 'text', 'wifi', 'email', 'phone', 'sms', 'location', 'contact'] as QRType[] as type (type)}
                      <button
                        class={cn(
                          'relative p-3 rounded-lg border-2 transition-all duration-200',
                          'flex flex-col items-center gap-1.5 text-sm',
                          qrType === type ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50 hover:bg-accent'
                        )}
                        onclick={() => {
                          qrType = type;
                          qrInput = '';
                          qrDataUrl = null;
                        }}
                      >
                        {#if getQRTypeIcon(type) === Link2}
                          <Link2 class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === FileText}
                          <FileText class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === Wifi}
                          <Wifi class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === Mail}
                          <Mail class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === Phone}
                          <Phone class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === MessageSquare}
                          <MessageSquare class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === MapPin}
                          <MapPin class="h-5 w-5" />
                        {:else if getQRTypeIcon(type) === User}
                          <User class="h-5 w-5" />
                        {/if}
                        <span class="font-medium">{getQRTypeLabel(type)}</span>
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Input -->
                <div>
                  <Label class="text-sm font-medium mb-2 block">Content</Label>
                  {#if qrType === 'url' || qrType === 'text' || qrType === 'phone'}
                    <Textarea bind:value={qrInput} placeholder={getQRTypePlaceholder(qrType)} class="min-h-[100px] font-mono text-sm" rows={4} />
                  {:else if qrType === 'wifi'}
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Network name (SSID)</Label>
                        <Input bind:value={wifiSsid} placeholder="MyNetwork" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Password</Label>
                        <Input bind:value={wifiPassword} placeholder="••••••••" type="text" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Encryption</Label>
                        <Select bind:value={wifiEncryption} type="single">
                          <SelectTrigger class="w-full">Select</SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WPA">WPA/WPA2</SelectItem>
                            <SelectItem value="WEP">WEP</SelectItem>
                            <SelectItem value="nopass">No encryption</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Label class="flex items-center gap-2 cursor-pointer">
                        <Switch bind:checked={wifiHidden} />
                        <span>Hidden network</span>
                      </Label>
                    </div>
                  {:else if qrType === 'email'}
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Recipient</Label>
                        <Input bind:value={emailTo} placeholder="email@example.com" type="email" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Subject (optional)</Label>
                        <Input bind:value={emailSubject} placeholder="Greetings" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Body (optional)</Label>
                        <Textarea bind:value={emailBody} rows={3} placeholder="Hello..." />
                      </div>
                    </div>
                  {:else if qrType === 'sms'}
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Phone number</Label>
                        <Input bind:value={smsNumber} placeholder="+1234567890" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Message</Label>
                        <Textarea bind:value={smsMessage} rows={3} placeholder="Hello..." />
                      </div>
                    </div>
                  {:else if qrType === 'location'}
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Latitude</Label>
                        <Input bind:value={locLat} placeholder="37.7749" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Longitude</Label>
                        <Input bind:value={locLng} placeholder="-122.4194" />
                      </div>
                    </div>
                    <Button variant="outline" size="sm" class="mt-3 w-full" onclick={useMyLocation}>
                      {#if locating}
                        <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
                        Locating...
                      {:else}
                        <MapPin class="h-4 w-4 mr-2" />
                        Use my current location
                      {/if}
                    </Button>
                  {:else if qrType === 'contact'}
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Full name</Label>
                        <Input bind:value={contactName} placeholder="Jane Doe" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Phone (optional)</Label>
                        <Input bind:value={contactPhone} placeholder="+1234567890" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Email (optional)</Label>
                        <Input bind:value={contactEmail} placeholder="hello@example.com" type="email" />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Organization (optional)</Label>
                        <Input bind:value={contactOrg} placeholder="Acme Inc." />
                      </div>
                      <div>
                        <Label class="text-xs mb-1 block text-muted-foreground">Website (optional)</Label>
                        <Input bind:value={contactUrl} placeholder="https://example.com" />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Customization -->
                <Separator class="my-2" />
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label class="text-sm font-medium mb-2 block">Foreground Color</Label>
                    <input type="color" bind:value={qrColor} class="w-full h-10 rounded-lg border border-border bg-transparent cursor-pointer" />
                  </div>
                  <div>
                    <Label class="text-sm font-medium mb-2 block">Background Color</Label>
                    <input type="color" bind:value={qrBgColor} class="w-full h-10 rounded-lg border border-border bg-transparent cursor-pointer" />
                  </div>
                  <div>
                    <Label class="text-sm font-medium mb-2 block">Size: {qrSize}px</Label>
                    <input type="range" bind:value={qrSize} min={128} max={512} step={32} class="w-full" />
                  </div>
                  <div>
                    <Label class="text-sm font-medium mb-2 block">Margin: {qrMargin}</Label>
                    <input type="range" bind:value={qrMargin} min={0} max={10} step={1} class="w-full" />
                  </div>
                </div>

                <!-- Generate Button -->
                <Button class="w-full mt-2" size="lg" onclick={generateQRCode} disabled={!isFormValid() || isGenerating}>
                  {#if isGenerating}
                    <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  {:else}
                    <QrCode class="h-4 w-4 mr-2" />
                    Generate QR Code
                  {/if}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Preview -->
          {#if qrDataUrl}
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2">
                  <Image class="h-5 w-5 text-primary" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent class="pt-0">
                <div class="flex flex-col items-center gap-4">
                  <div class="bg-white p-4 rounded-lg shadow-sm">
                    <img src={qrDataUrl} alt="Generated QR Code" class="mx-auto" style="max-width: 100%; height: auto;" />
                  </div>
                  <div class="flex flex-wrap gap-2 justify-center w-full">
                    <Button onclick={downloadQRCode}>
                      <Download class="h-4 w-4 mr-2" />
                      Download PNG
                    </Button>
                    <Button variant="outline" onclick={shareQRCode}>
                      <Share2 class="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="outline" onclick={() => copyToClipboard(qrInput, 'preview-copy')}>
                      {#if copiedId === 'preview-copy'}
                        <Check class="h-4 w-4 mr-2" />
                        Copied!
                      {:else}
                        <Copy class="h-4 w-4 mr-2" />
                        Copy Data
                      {/if}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          {/if}
        </div>
        <!-- HISTORY TAB -->
      {:else if activeTab === 'history'}
        <div class="max-w-2xl mx-auto w-full">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold flex items-center gap-2">
              <History class="h-5 w-5" />
              History
            </h2>
            {#if history.length > 0}
              <Button variant="ghost" size="sm" onclick={clearHistory}>
                <Trash2 class="h-4 w-4 mr-1" />
                Clear All
              </Button>
            {/if}
          </div>

          {#if !settings.showHistory && history.length === 0}
            <Card class="py-12 text-center">
              <CardContent>
                <Settings class="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 class="text-lg font-medium mb-1">History is disabled</h3>
                <p class="text-muted-foreground text-sm">Enable history in Settings to record your scans and creations</p>
              </CardContent>
            </Card>
          {:else if history.length === 0}
            <Card class="py-12 text-center">
              <CardContent>
                <History class="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 class="text-lg font-medium mb-1">No history yet</h3>
                <p class="text-muted-foreground text-sm">Scan or create QR codes to see them here</p>
              </CardContent>
            </Card>
          {:else}
            <ScrollArea class="h-[calc(100vh-200px)] min-h-[300px]">
              <div class="space-y-3">
                {#each history as item (item.id)}
                  <Card class="hover:shadow-md transition-shadow">
                    <CardContent class="p-4">
                      <div class="flex items-start gap-3">
                        <div
                          class={cn(
                            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                            item.type === 'scan'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          )}
                        >
                          {#if item.type === 'scan'}
                            <Camera class="h-5 w-5" />
                          {:else}
                            <QrCode class="h-5 w-5" />
                          {/if}
                        </div>

                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <Badge variant={item.type === 'scan' ? 'default' : 'secondary'} class="text-xs">
                              {item.type === 'scan' ? 'Scanned' : 'Created'}
                            </Badge>
                            {#if item.qrType}
                              <Badge variant="outline" class="text-xs">
                                {#if getQRTypeIcon(item.qrType) === Link2}
                                  <Link2 class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === FileText}
                                  <FileText class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === Wifi}
                                  <Wifi class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === Mail}
                                  <Mail class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === Phone}
                                  <Phone class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === MessageSquare}
                                  <MessageSquare class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === MapPin}
                                  <MapPin class="h-3 w-3 mr-1" />
                                {:else if getQRTypeIcon(item.qrType) === User}
                                  <User class="h-3 w-3 mr-1" />
                                {/if}
                                {getQRTypeLabel(item.qrType)}
                              </Badge>
                            {/if}
                            <span class="text-xs text-muted-foreground ml-auto">{formatTimestamp(item.timestamp)}</span>
                          </div>

                          <p class="mt-2 text-sm break-all font-mono text-foreground/80">{item.content}</p>

                          <div class="flex items-center gap-2 mt-3">
                            <Button variant="ghost" size="icon" onclick={() => copyToClipboard(item.content, `history-${item.id}`)}>
                              {#if copiedId === `history-${item.id}`}
                                <Check class="h-4 w-4 text-green-600" />
                              {:else}
                                <Copy class="h-4 w-4" />
                              {/if}
                              <span class="sr-only">Copy</span>
                            </Button>
                            {#if item.dataUrl}
                              <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => {
                                  generatedQrDataUrl = item.dataUrl ?? null;
                                  showQrDialog = true;
                                }}
                              >
                                <Eye class="h-4 w-4" />
                                <span class="sr-only">View QR</span>
                              </Button>
                            {/if}
                            <Button variant="ghost" size="icon" onclick={() => deleteHistoryItem(item.id)}>
                              <Trash2 class="h-4 w-4 text-destructive" />
                              <span class="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                {/each}
              </div>
            </ScrollArea>
          {/if}
        </div>
        <!-- SETTINGS TAB -->
      {:else if activeTab === 'settings'}
        <div class="max-w-2xl mx-auto w-full space-y-6">
          <!-- Appearance -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Monitor class="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-0 space-y-4">
              <div class="space-y-3">
                <label class="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                  <div class="flex items-center gap-3">
                    <Sun class="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p class="font-medium">Light</p>
                      <p class="text-sm text-muted-foreground">Always use light mode</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={settings.theme === 'light'}
                    onchange={() => {
                      settings.theme = 'light';
                      saveSettings();
                    }}
                    class="sr-only"
                  />
                </label>
                <label class="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                  <div class="flex items-center gap-3">
                    <Moon class="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p class="font-medium">Dark</p>
                      <p class="text-sm text-muted-foreground">Always use dark mode</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={settings.theme === 'dark'}
                    onchange={() => {
                      settings.theme = 'dark';
                      saveSettings();
                    }}
                    class="sr-only"
                  />
                </label>
                <label class="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                  <div class="flex items-center gap-3">
                    <Monitor class="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p class="font-medium">System</p>
                      <p class="text-sm text-muted-foreground">Follow system preference</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    checked={settings.theme === 'system'}
                    onchange={() => {
                      settings.theme = 'system';
                      saveSettings();
                    }}
                    class="sr-only"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <!-- Scan Settings -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Camera class="h-5 w-5 text-primary" />
                Scanning
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-0 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Vibration on scan</p>
                  <p class="text-sm text-muted-foreground">Haptic feedback when QR code is detected</p>
                </div>
                <Switch
                  checked={settings.vibration}
                  onCheckedChange={v => {
                    settings.vibration = v;
                    saveSettings();
                  }}
                />
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Sound on scan</p>
                  <p class="text-sm text-muted-foreground">Play a beep when QR code is detected</p>
                </div>
                <Switch
                  checked={settings.sound}
                  onCheckedChange={v => {
                    settings.sound = v;
                    saveSettings();
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <!-- History Settings -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <History class="h-5 w-5 text-primary" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-0 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Save history</p>
                  <p class="text-sm text-muted-foreground">Keep a record of scanned and created QR codes</p>
                </div>
                <Switch
                  checked={settings.showHistory}
                  onCheckedChange={v => {
                    settings.showHistory = v;
                    saveSettings();
                  }}
                />
              </div>
              {#if settings.showHistory && history.length > 0}
                <Button variant="outline" onclick={clearHistory} class="w-full">
                  <Trash2 class="h-4 w-4 mr-2" />
                  Clear All History ({history.length} items)
                </Button>
              {/if}
            </CardContent>
          </Card>

          <!-- Install (PWA) -->
          {#if !installState.isInstalled}
            <Card>
              <CardHeader>
                <CardTitle class="flex items-center gap-2">
                  <Download class="h-5 w-5 text-primary" />
                  Install App
                </CardTitle>
              </CardHeader>
              <CardContent class="pt-0 space-y-3">
                <p class="text-sm text-muted-foreground">
                  Add QR Code to your home screen for quick access — it works offline, just like a native app.
                </p>
                <Button onclick={installApp} disabled={isInstalling} class="w-full">
                  {#if isInstalling}
                    <LoaderCircle class="h-4 w-4 mr-2 animate-spin" />
                    Installing…
                  {:else}
                    <Download class="h-4 w-4 mr-2" />
                    Install
                  {/if}
                </Button>
              </CardContent>
            </Card>
          {/if}

          <!-- About -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Info class="h-5 w-5 text-primary" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-0 space-y-4">
              <div class="space-y-2 text-sm">
                <p class="font-medium">QR Code Reader & Creator</p>
                <p class="text-muted-foreground">A Progressive Web App for scanning and creating QR codes</p>
                <p class="text-sm text-muted-foreground">Version {version}</p>
                <p class="text-sm text-muted-foreground">Build {process.env.BUILDTIME}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Badge variant="outline">PWA Ready</Badge>
                <Badge variant="outline">Offline Support</Badge>
                <Badge variant="outline">No Tracking</Badge>
                <Badge variant="outline">Open Source</Badge>
              </div>
              <div class="pt-2 border-t">
                <p class="text-xs text-muted-foreground text-center">© {year} AZTemi</p>
              </div>
            </CardContent>
          </Card>
        </div>
      {/if}
    </div>
  </main>

  <!-- Mobile Tabs (bottom) -->
  <div
    class="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-50"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
  >
    <div class="flex h-18 w-full" role="tablist">
      <button
        class={cn(
          'relative flex flex-col items-center justify-center gap-1 text-xs font-medium flex-1 transition-colors',
          activeTab === 'scan' ? 'text-primary' : 'text-muted-foreground'
        )}
        onclick={() => (activeTab = 'scan')}
      >
        <Camera class="h-5 w-5" />
        <span>Scan</span>
        {#if activeTab === 'scan'}
          <span class="absolute top-0 left-0 right-0 h-0.5 bg-primary"></span>
        {/if}
      </button>
      <button
        class={cn(
          'relative flex flex-col items-center justify-center gap-1 text-xs font-medium flex-1 transition-colors',
          activeTab === 'create' ? 'text-primary' : 'text-muted-foreground'
        )}
        onclick={() => (activeTab = 'create')}
      >
        <QrCode class="h-5 w-5" />
        <span>Create</span>
        {#if activeTab === 'create'}
          <span class="absolute top-0 left-0 right-0 h-0.5 bg-primary"></span>
        {/if}
      </button>
      <button
        class={cn(
          'relative flex flex-col items-center justify-center gap-1 text-xs font-medium flex-1 transition-colors',
          activeTab === 'history' ? 'text-primary' : 'text-muted-foreground'
        )}
        onclick={() => (activeTab = 'history')}
      >
        <History class="h-5 w-5" />
        <span>History</span>
        {#if activeTab === 'history'}
          <span class="absolute top-0 left-0 right-0 h-0.5 bg-primary"></span>
        {/if}
      </button>
      <button
        class={cn(
          'relative flex flex-col items-center justify-center gap-1 text-xs font-medium flex-1 transition-colors',
          activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground'
        )}
        onclick={() => (activeTab = 'settings')}
      >
        <Settings class="h-5 w-5" />
        <span>Settings</span>
        {#if activeTab === 'settings'}
          <span class="absolute top-0 left-0 right-0 h-0.5 bg-primary"></span>
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- QR Code Dialog -->
<Dialog open={showQrDialog} onOpenChange={v => (showQrDialog = v)}>
  <DialogContent class="max-w-sm">
    <DialogHeader>
      <DialogTitle>Generated QR Code</DialogTitle>
      <DialogDescription>Scan or share this QR code</DialogDescription>
    </DialogHeader>
    <div class="flex flex-col items-center gap-4 py-4">
      {#if generatedQrDataUrl}
        <div class="bg-white p-4 rounded-lg shadow-sm">
          <img src={generatedQrDataUrl} alt="QR Code" />
        </div>
        <div class="flex flex-wrap gap-2 justify-center w-full">
          <Button onclick={downloadQRCode} class="w-full sm:w-auto">
            <Download class="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" onclick={shareQRCode} class="w-full sm:w-auto">
            <Share2 class="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onclick={() => copyToClipboard(qrInput, 'dialog-copy')} class="w-full sm:w-auto">
            {#if copiedId === 'dialog-copy'}
              <Check class="h-4 w-4 mr-2" />
              Copied!
            {:else}
              <Copy class="h-4 w-4 mr-2" />
              Copy Data
            {/if}
          </Button>
        </div>
      {/if}
    </div>
  </DialogContent>
</Dialog>

<!-- iOS Manual Install Dialog -->
<Dialog open={showInstallDialog} onOpenChange={v => (showInstallDialog = v)}>
  <DialogContent class="max-w-sm">
    <DialogHeader>
      <DialogTitle>Add to Home Screen</DialogTitle>
      <DialogDescription>Install QR Code like a native app on your iPhone or iPad.</DialogDescription>
    </DialogHeader>
    <ol class="space-y-3 text-sm">
      <li class="flex items-start gap-3">
        <span class="flex shrink-0 size-6 rounded-full bg-primary text-primary-foreground items-center justify-center text-xs font-semibold">1</span>
        <span class="flex items-center gap-1.5 pt-0.5">
          Tap the <Share2 class="h-4 w-4 text-primary" /> <strong class="font-semibold">Share</strong> button in Safari's toolbar.
        </span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex shrink-0 size-6 rounded-full bg-primary text-primary-foreground items-center justify-center text-xs font-semibold">2</span>
        <span class="flex items-center gap-1.5 pt-0.5">
          Scroll and choose <PlusSquare class="h-4 w-4 text-primary" /> <strong class="font-semibold">Add to Home Screen</strong>.
        </span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex shrink-0 size-6 rounded-full bg-primary text-primary-foreground items-center justify-center text-xs font-semibold">3</span>
        <span class="flex items-center gap-1.5 pt-0.5">
          Tap <ChevronRight class="h-4 w-4 text-primary" /> <strong class="font-semibold">Add</strong> — that's it.
        </span>
      </li>
    </ol>
  </DialogContent>
</Dialog>

<style>
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: oklch(var(--muted-foreground) / 0.3);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: oklch(var(--muted-foreground) / 0.5);
  }

  *:focus-visible {
    outline: 2px solid oklch(var(--ring));
    outline-offset: 2px;
  }

  @media (display-mode: standalone) {
    header {
      padding-top: env(safe-area-inset-top);
    }
    main {
      padding-bottom: calc(6.25rem + env(safe-area-inset-bottom));
    }
  }
</style>
