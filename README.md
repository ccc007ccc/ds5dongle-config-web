# M61 DualSense Configurator

[简体中文](README.zh-CN.md)

WebHID configuration and diagnostics for the M61 BL616/BL618 DualSense
Bluetooth-to-USB firmware.

This repository is dedicated to the M61 firmware and hardware.

## Use the configurator

Open <https://ds5.766677.xyz/> in Chrome, Edge, or
another Chromium-based browser. WebHID requires HTTPS (or `localhost` during
development).

1. Connect and power the M61, then select **Connect device** and choose the
   M61 DualSense USB device.
2. Read the current configuration before editing it.
3. Change only the settings you need and select **Save configuration**. The
   firmware persists the complete configuration in Flash.
4. Reconnect the controller or reset the M61 when the page says a setting
   requires it.

A real wired DualSense can appear in the browser picker because M61 mirrors
its Sony USB identity. The page keeps all controls locked until the selected
device returns a valid versioned `M61C` configuration report; non-M61 devices
are closed without sending configuration commands.

Production defaults are intentionally conservative: microphone input is off,
the CPU runs at 320 MHz, overclocking is off, and stick deadzones are 0%.
Microphone decoding and overclocking materially increase load and may cause
stutter, so the UI displays warnings before enabling them. USB report modes
are realtime forwarding, validated fixed 250 Hz, and validated fixed 500 Hz;
they do not increase the Bluetooth controller's native sample rate.

The supported controller target is the standard DualSense. DualSense Edge is
not supported or hardware-qualified.

Current controls include audio routing, the controller audio-buffer hint,
haptics gain, hardware-PWM status-LED brightness, safe CPU profiles, manual
stick deadzones, 250/500 Hz USB report modes, controller inactivity and
host-suspend power policies, pairing/disconnect/forget/power-off actions,
Flash persistence, and bounded diagnostics export. The deadzone panel draws
live stick positions directly from the existing USB HID input stream and
coalesces 250/500 Hz events to at most one canvas update per display frame; it
does not poll Feature reports or add firmware traffic. Browser firmware
flashing is not provided; use the firmware repository's UART ISP instructions.

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
root and preserves the `ds5.766677.xyz` custom-domain record. Vite uses
relative asset URLs so both the custom domain and the GitHub project URL work.

Firmware source, release files, wiring, protocol details, and limitations are
maintained in the [DS5Dongle repository](https://github.com/ccc007ccc/DS5Dongle).
