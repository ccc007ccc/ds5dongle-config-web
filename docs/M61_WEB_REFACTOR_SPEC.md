# M61 Web configurator specification

[简体中文](M61_WEB_REFACTOR_SPEC.zh-CN.md)

## Product boundary

This repository is the configuration and diagnostics application for the M61
BL616/BL618 DualSense dongle. Every setting, label, asset, protocol type, and
document must describe an M61 capability. Generic React, WebHID, and PWA
technology remains implementation detail rather than a second product mode.

## Management protocol

| Report | Direction | Meaning |
| --- | --- | --- |
| `0xF6` | host to M61 | apply, save, USB reconnect, and maintenance commands |
| `0xF7` | M61 to host | current versioned configuration |
| `0xF8` | M61 to host | firmware and reproducible-build metadata |
| `0xF9` | M61 to host | live telemetry and capability state |

All reports use 63-byte payloads. Configuration starts with `M61C`, schema
version, payload length, and capability bits. Multi-byte values are
little-endian. Unknown magic, versions, lengths, commands, or ranges are
rejected before state changes. Reports `0xF6` through `0xF9` are handled by the
M61 itself; every other DualSense Feature Report keeps the controller proxy.

## Configuration v1

The schema contains microphone enable, speaker enable, speaker route,
automatic reconnect, M61 status LED enable, Q8 haptics gain, CPU governor,
CPU profile, and safe manual frequency. The UI renders a control only when its
capability bit is present. Frequencies above the validated 400 MHz limit are
never writable through the normal Web application.

Applying changes is immediate and serialized. Saving is a separate operation
that writes one versioned, CRC-protected record to Flash. Invalid records fall
back to the measured release defaults. Flash access and USB cycling execute in
task context, never in a HID callback or realtime audio path.

## Telemetry v1

Telemetry exposes stable product data: Bluetooth connection and RSSI validity,
USB configured/suspended state, speaker and microphone activity, headset and
effective channel route, current/requested CPU clock, bounded queue/drop/error
counters, configuration state, and last management error. Encoding is static,
allocation-free, nonblocking, and safe in the USB control path.

## Delivery packages

1. Protocol foundation: cross-language fixtures, local report interception,
   firmware identity, configuration readback, DVFS apply, and hardware tests.
2. Central configuration: CRC persistence and integration of microphone,
   speaker, route, reconnect, LED, haptics gain, and DVFS.
3. M61 interface: capability-driven Controller, Audio, Performance, Device,
   and Diagnostics sections with complete English/Chinese coverage.
4. Operations: pairing, disconnect, forget, diagnostics export, and guarded
   ISP reboot.
5. Power policy: configurable controller inactivity timeout, explicit
   controller power-off, host-suspend policy, and reconnect behavior. Input
   activity is derived from decoded M61 DualSense reports rather than copied
   platform-specific heuristics. Timeout `0` disables automatic power-off;
   nonzero values are bounded to 1–60 minutes. Power-off uses the DualSense
   Bluetooth Feature Report `0x08`, then observes the normal link teardown.
6. Hardware release: full-load audio, RAM/ITCM, reconnect, power-cycle, and
   Chromium WebHID acceptance.

## Performance and safety gates

- Keep the locked SDK, toolchain, Opus patch stack, 160 KiB WRAM, compiler
  options, and build manifest.
- Add no per-frame allocation, logging, Flash access, or blocking to audio.
- Existing offline, protocol, scheduler, memory, and full firmware builds pass.
- Full-load hardware audio shows no new codec errors or queue drops.
- Web tests, TypeScript build, PWA build, disconnect recovery, and bilingual
  key parity pass.
- Source, UI, assets, metadata, README, and product documentation contain only
  M61 product concepts; dependency lock files are excluded from this check.
