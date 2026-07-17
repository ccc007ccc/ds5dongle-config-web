# M61 Web configurator refactor specification

[简体中文](M61_WEB_REFACTOR_SPEC.zh-CN.md)

## 1. Goal

Turn the Pico2W-oriented configurator into the official M61 configurator
without weakening the firmware's measured realtime release profile. The Web
application and firmware must share a versioned, testable management protocol.

## 2. Protocol

The initial implementation keeps Feature Report IDs to minimize browser-side
transport churn, but changes the schema identity:

| Report | Direction | M61 meaning |
| --- | --- | --- |
| `0xF6` | host to device | command envelope: apply, save, USB reconnect, later maintenance commands |
| `0xF7` | device to host | current M61 configuration |
| `0xF8` | device to host | firmware/build metadata |
| `0xF9` | device to host | compact live telemetry |

Requirements:

- Add an M61 protocol magic and schema version. Pico config v5 must fail with a
  clear incompatible-device error.
- WebHID payloads remain 63 bytes. All unused bytes are zero.
- Multi-byte integers are little-endian. Boolean values must be `0` or `1`.
- Every command is validated completely before any state changes.
- `0xF6`–`0xF9` are handled locally and never enter the controller Feature
  request queues. All other report IDs retain the existing proxy behavior.
- `0xF9` keeps an RSSI/activity compatibility prefix: signed RSSI byte followed
  by flags with bit 7 valid, bit 1 speaker active, and bit 0 microphone active.
  Versioned M61 telemetry follows that prefix.

## 3. Configuration model v1

The first schema contains only settings with an implemented and testable M61
meaning:

| Field | Type/range | Apply behavior | Persistence |
| --- | --- | --- | --- |
| microphone enabled | bool | immediate; disabled mode serves USB silence | explicit save |
| speaker enabled | bool | immediate; must not disable HD haptics | explicit save |
| speaker route | auto/mono/stereo | immediate | explicit save |
| automatic reconnect | bool | immediate for the connection state machine | explicit save |
| status LED enabled | bool | immediate, automatic state when enabled | explicit save |
| haptics gain | validated fixed-point range | immediate, saturating scale | explicit save |
| CPU governor | manual/realtime | immediate | explicit save |
| CPU profile/frequency | safe profile or 320–400 MHz | immediate | explicit save |

Experimental clocks above 400 MHz are never writable or persistent through the
normal Web UI. Descriptor-changing settings are not part of v1.

The firmware stores a single record containing magic, schema version, payload
length, payload, and CRC. Invalid or unknown records fall back to release
defaults and report the reason through telemetry. Saving is explicit to limit
Flash wear.

## 4. Telemetry model v1

Expose stable product data, not raw internal structs:

- Bluetooth state, saved controller, pairing/scanning state, and RSSI validity;
- USB configured/suspended state;
- speaker/microphone active, jack state, effective mono/stereo route;
- current/requested CPU frequency and governor;
- compact queue depth/high-water/drop and codec error counters;
- config loaded/dirty/valid state and last management error.

Counters may saturate. The report must be safe to create inside the HID control
path without blocking or allocating memory.

## 5. Firmware work packages

### F0 — protocol foundation

- Add `m61_web_config.[ch]` with defaults, validation, runtime apply, persistence,
  report encoding, and unit-testable pure functions.
- Intercept `0xF6`–`0xF9` in HID GET/SET callbacks.
- Defer USB cycling and other disruptive actions to task context.
- Add host tests for decode/encode, invalid lengths/versions/ranges, local-report
  interception, proxy preservation, and save/load CRC failures.

### F1 — integrate existing M61 settings

- Route microphone, speaker route, automatic reconnect, status LED, and DVFS
  through one configuration owner.
- Add speaker enable and runtime haptics gain without changing queue sizes,
  priorities, codec options, or memory placement.
- Preserve current release defaults when no valid record exists.

### F2 — telemetry and controller management

- Implement telemetry v1 and connected RSSI sampling when supported.
- Add asynchronous pair/scan/disconnect/forget commands with state polling.
- Never block a USB control callback on Bluetooth discovery.

## 6. Web work packages

### W0 — protocol and tests

- Split transport, schema, and presentation types.
- Detect M61 magic/version before decoding configuration.
- Add fixture tests for all reports and invalid responses.
- Keep serialized/coalesced immediate apply and explicit save semantics.

### W1 — M61 information architecture

- Rename product/Pico wording and update README/PWA metadata.
- Replace the Pico field list with tabs or sections for Controller, Audio,
  Performance, Device, and Diagnostics.
- Show effective versus configured values and reconnect requirements.
- Preserve English/Chinese parity for every string.

### W2 — M61 operations

- Add pairing, disconnect, forget, telemetry health, diagnostics export, and a
  guarded ISP reboot flow.
- Hide unavailable capabilities based on protocol capability bits rather than
  rendering controls that cannot work.

## 7. Performance and safety gates

Firmware acceptance requires:

- existing offline tests and full Windows release build pass;
- identical release compiler/Opus/WRAM settings and a provenance manifest;
- no additional per-audio-frame allocation, logging, Flash access, or blocking;
- RAM/ITCM gates remain within current limits;
- hardware full-load audio has no new encode/decode errors or queue drops;
- config apply/save/reconnect fuzz and power-loss behavior are tested.

Web acceptance requires TypeScript build, protocol fixture tests, browser manual
tests in Chromium, disconnect/reconnect recovery, and matching English/Chinese
coverage.

## 8. Delivery order

1. F0 + W0: negotiated protocol and read-only identity/config round trip.
2. F1 + W1: usable M61 configuration with apply/save/reconnect.
3. F2 + W2: pairing, health telemetry, diagnostics, and maintenance.
4. Hardware validation and public release.
5. Evaluate deferred Pico features individually; none enter the UI before their
   firmware semantics and performance evidence exist.
