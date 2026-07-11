# QR Code Reader & Creator

A Progressive Web App for scanning and generating QR codes, built with SvelteKit.

## Features

- **Scan QR codes** via camera or from image files
- **Create QR codes** for URLs, plain text, WiFi networks, emails, phone numbers, SMS, locations, and vCard contacts
- **Customize** foreground/background colors, size, and margin
- **History** of scanned and created QR codes (stored locally)
- **Theme support** — light, dark, and system modes
- **PWA-ready** with service worker and offline support
- **Responsive** — mobile bottom tabs, desktop top tabs
- Haptic vibration and sound feedback on scan

## Tech Stack

- SvelteKit + Svelte 5
- Tailwind CSS v4 + shadcn-svelte
- Lucide icons
- qrcode — QR code generation
- html5-qrcode — camera/image scanning
- vite-plugin-pwa — PWA support

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
