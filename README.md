# QR Code Reader & Creator

A Progressive Web App for scanning and generating QR codes, built with SvelteKit.

## Features

- **Scan QR codes** via camera or from image files with animated scan overlay
- **Create QR codes** for 8 data types with structured input forms
- **Customize** foreground/background colors, size (128–512px), and margin
- **Download, share, and copy** generated QR codes (Web Share API)
- **History** of scanned and created QR codes with relative timestamps (localStorage, max 100 items, toggleable)
- **Theme support** — light, dark, and system modes
- **PWA-ready** with offline support and auto-updating service worker
- **Responsive** — mobile bottom tabs, desktop top tabs

## QR Code Types

| Type         | Output Format                    |
| ------------ | -------------------------------- |
| URL / Link   | Raw URL                          |
| Plain Text   | Raw text                         |
| WiFi Network | `WIFI:T:...;S:...;P:...;;`       |
| Email        | `mailto:` URI with subject/body  |
| Phone Number | `tel:` URI                       |
| SMS          | `sms:` URI with message          |
| Location     | `geo:` URI (latitude, longitude) |
| Contact      | vCard 3.0                        |

## Tech Stack

- **SvelteKit** + **Svelte 5** (runes)
- **Tailwind CSS v4** + **shadcn-svelte** (Vega style)
- **Lucide** icons
- **qrcode** — QR code generation
- **html5-qrcode** — camera/image scanning
- **vite-plugin-pwa** — service worker, manifest, Workbox caching

## PWA

- Service worker registered eagerly for offline support on iOS Safari cold starts
- Install prompt on Chromium/Android (native `beforeinstallprompt`)
- Manual "Add to Home Screen" instructions on iOS Safari
- Install banner requires user interaction + 30s on page before showing; dismissal persists 14 days
- Auto-update via `registerType: 'autoUpdate'`

## Getting Started

```sh
npm install
npm run dev
```

## Building for Production

```sh
npm run build
```

The output will be in the `build` directory. You can preview it locally:

```sh
npm run preview
```

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start dev server               |
| `npm run build`   | Production build               |
| `npm run preview` | Preview production build       |
| `npm run check`   | Type-check with svelte-check   |
| `npm run lint`    | Check formatting with Prettier |
| `npm run format`  | Fix formatting with Prettier   |

## License

[GPL-3.0](./LICENSE)
