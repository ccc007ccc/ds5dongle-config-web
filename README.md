# M61 DualSense Configurator

[简体中文](README.zh-CN.md)

WebHID configuration and diagnostics for the M61 BL616/BL618 DualSense
Bluetooth-to-USB firmware.

This repository is dedicated to the M61 firmware and hardware.

## Development

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
```

Use a Chromium-based browser on HTTPS or `localhost`. The connected firmware
must implement M61 management reports `0xF6` through `0xF9`.

See [the migration specification](docs/M61_WEB_REFACTOR_SPEC.md) and
[the feature matrix](docs/M61_FEATURE_GAP_MATRIX.csv).
