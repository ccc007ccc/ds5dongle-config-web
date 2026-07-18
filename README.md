# M61 DualSense Configurator

[简体中文](README.zh-CN.md)

WebHID configuration and diagnostics for the M61 BL616/BL618 DualSense
Bluetooth-to-USB firmware.

This repository is dedicated to the M61 firmware and hardware.

## Use the configurator

Open <https://ccc007ccc.github.io/ds5dongle-config-web/> in Chrome, Edge, or
another Chromium-based browser. WebHID requires HTTPS (or `localhost` during
development).

1. Connect and power the M61, then select **Connect device** and choose the
   M61 DualSense USB device.
2. Read the current configuration before editing it.
3. Change only the settings you need and select **Save configuration**. The
   firmware persists the complete configuration in Flash.
4. Reconnect the controller or reset the M61 when the page says a setting
   requires it.

Production defaults are intentionally conservative: microphone input is off,
the CPU runs at 320 MHz, overclocking is off, and stick deadzones are 0%.
Microphone decoding and overclocking materially increase load and may cause
stutter, so the UI displays warnings before enabling them. USB report modes
are realtime forwarding, validated fixed 250 Hz, and validated fixed 500 Hz;
they do not increase the Bluetooth controller's native sample rate.

## Local development and validation

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
```

Preview the production build with `corepack pnpm preview`. The connected
firmware must implement M61 management reports `0xF6` through `0xF9`.

## Deployment

Every push to `master` runs tests, builds the static site, and publishes
`dist/` to the `gh-pages` branch. GitHub Pages serves that branch from its
root. The production Vite base path is `/ds5dongle-config-web/`; local builds
continue to use `/`.

See [the migration specification](docs/M61_WEB_REFACTOR_SPEC.md) and
[the feature matrix](docs/M61_FEATURE_GAP_MATRIX.csv).
