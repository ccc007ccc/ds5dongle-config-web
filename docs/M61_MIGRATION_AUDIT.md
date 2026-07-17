# M61 migration audit

[简体中文](M61_MIGRATION_AUDIT.zh-CN.md)

## Result

The current site cannot configure the M61 firmware even though the device
descriptor declares Feature Reports `0xF6` through `0xF9`. The site assigns
those reports a private Pico2W management protocol, while the M61 firmware
currently proxies every Feature Report to the physical DualSense. A Web read
therefore does not return the site's config version 5, and a write can be sent
to the controller instead of changing dongle settings.

The authoritative row-by-row inventory is
[`M61_FEATURE_GAP_MATRIX.csv`](M61_FEATURE_GAP_MATRIX.csv).

## Existing Web application

The React/Vite PWA already provides a useful shell:

- WebHID device selection and reopening of previously authorized devices;
- immediate apply with serialized/coalesced writes;
- explicit flash save, USB reconnect, defaults, readback, validation, and
  disconnect recovery;
- firmware version, RSSI, and speaker/microphone activity display;
- English/Chinese localization, responsive UI, light/dark/system themes,
  toast errors, and service-worker update prompting.

Its Pico config v5 contains 15 fields: haptics gain, speaker/headset volume,
speaker gain, inactivity timeout, Pico LED disable, polling mode, audio buffer
length, controller identity, USB serial, PS shortcut, microphone disable,
speaker disable, USB wake, and trigger reduction.

## Existing M61 firmware

The M61 firmware already exceeds the Pico-oriented UI in several areas:

- Bluetooth Classic discovery, pairing, saved-address reconnect, security,
  SDP, HIDP control/interrupt channels, disconnect, and forget;
- complete DualSense USB HID input/output and Feature GET/SET bridging;
- four-channel USB audio OUT, HD haptics, speaker/headset routing, Opus encode,
  microphone Opus decode, USB audio volume/mute state, and audio health data;
- runtime microphone enable and automatic/mono/stereo speaker routing;
- manual or realtime DVFS, safe profiles, custom 320–400 MHz locks, transient
  boost, explicit persistence, and guarded experimental clocks;
- USB reinitialization/cycle, ISP reboot, RGB status LED controls, quiet/normal
  logging, and extensive Bluetooth/USB/audio/performance diagnostics.

## Migration rules

1. Keep the WebHID/PWA architecture and the useful apply/save/reconnect state
   machine.
2. Intercept M61 management reports locally before the normal DualSense
   Feature proxy.
3. Negotiate a new M61 schema; never interpret Pico config v5 as M61 config.
4. Preserve the measured release pipeline. Dynamic queue depth or buffer
   controls are not exposed until benchmarks prove they are safe.
5. Prefer positive M61 concepts (`microphone enabled`, `status LED enabled`)
   over inherited negative Pico flags.
6. Treat descriptor-changing settings separately and require USB reconnect.
7. Keep flash writes explicit and validate the complete record before applying
   or persisting it.

## Initial delivery boundary

The first usable M61 release includes protocol negotiation, configuration
read/apply/save, USB reconnect, firmware metadata, audio activity, microphone
enable, speaker route, automatic reconnect, and safe DVFS settings. Bluetooth
pairing and richer health telemetry follow next. Edge identity, remote wake,
trigger transforms, shortcuts, and dynamic buffering remain gated by dedicated
hardware and performance validation.
