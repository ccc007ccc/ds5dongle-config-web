import assert from "node:assert/strict";
import test from "node:test";
import { en } from "../i18n/locales/en.ts";
import { zh } from "../i18n/locales/zh.ts";
import { DEFAULT_CONFIG, releaseDefaultsForDevice, usesElevatedCpuPerformance } from "./config.ts";
import {
  M61Capability,
  M61Command,
  M61_CONFIG_BODY_SIZE,
  M61_CONFIG_REPORT_ID,
  M61_FEATURE_PAYLOAD_SIZE,
  M61ProtocolError,
  decodeM61Config,
  decodeM61Telemetry,
  encodeM61Config,
  makeM61Command,
  type M61Config,
} from "./m61Management.ts";

const config: M61Config = {
  schemaVersion: 5,
  capabilities:
    M61Capability.Microphone |
    M61Capability.SpeakerRoute |
    M61Capability.AutoReconnect |
    M61Capability.Dvfs,
  microphoneEnabled: false,
  speakerEnabled: true,
  autoReconnectEnabled: true,
  statusLedEnabled: true,
  speakerRoute: 2,
  cpuGovernor: 1,
  cpuProfile: 2,
  manualCpuMhz: 400,
  hapticsGainQ8: 0x0180,
  idleTimeoutMinutes: 30,
  powerOffOnUsbSuspend: true,
  leftStickDeadzonePercent: 8,
  rightStickDeadzonePercent: 12,
  usbPollingRateMode: 2,
  statusLedBrightnessPercent: 35,
  audioBufferLength: 64,
};

test("M61 config round trips with and without report ID", () => {
  const encoded = encodeM61Config(config);
  assert.deepEqual(decodeM61Config(encoded), config);
  const withId = new Uint8Array(encoded.length + 1);
  withId[0] = M61_CONFIG_REPORT_ID;
  withId.set(encoded, 1);
  assert.deepEqual(decodeM61Config(withId), config);
});

test("retired schema-v4 polling value migrates to fixed 500 Hz", () => {
  const encoded = encodeM61Config({ ...config, schemaVersion: 4 });
  encoded[20] = 3;
  assert.equal(decodeM61Config(encoded).usbPollingRateMode, 2);
});

test("unknown polling values are rejected instead of silently clamped", () => {
  const encoded = encodeM61Config({ ...config, schemaVersion: 4 });
  encoded[20] = 4;
  assert.throws(() => decodeM61Config(encoded), (error: unknown) => {
    return error instanceof M61ProtocolError && error.code === "invalidConfig";
  });
});

test("release defaults preserve fields hidden by device capabilities", () => {
  const current: M61Config = {
    ...config,
    capabilities: M61Capability.Microphone,
    microphoneEnabled: true,
    speakerEnabled: false,
    cpuGovernor: 1,
    cpuProfile: 2,
    manualCpuMhz: 400,
    usbPollingRateMode: 2,
  };
  const defaults = releaseDefaultsForDevice(current);
  assert.equal(defaults.capabilities, M61Capability.Microphone);
  assert.equal(defaults.microphoneEnabled, DEFAULT_CONFIG.microphoneEnabled);
  assert.equal(defaults.speakerEnabled, current.speakerEnabled);
  assert.equal(defaults.cpuGovernor, current.cpuGovernor);
  assert.equal(defaults.cpuProfile, current.cpuProfile);
  assert.equal(defaults.manualCpuMhz, current.manualCpuMhz);
  assert.equal(defaults.usbPollingRateMode, current.usbPollingRateMode);
  assert.equal(defaults.statusLedBrightnessPercent, current.statusLedBrightnessPercent);
  assert.equal(defaults.audioBufferLength, current.audioBufferLength);
});

test("schema-v4 config receives safe defaults for new v5 controls", () => {
  const legacy = encodeM61Config({ ...config, schemaVersion: 4 });
  const decoded = decodeM61Config(legacy);
  assert.equal(decoded.schemaVersion, 4);
  assert.equal(decoded.statusLedBrightnessPercent, 12);
  assert.equal(decoded.audioBufferLength, 48);
});

test("schema-v1 through v4 bodies remain decodable", () => {
  const expectedSizes = [0, 16, 18, 20, 21];
  for (let schemaVersion = 1; schemaVersion <= 4; schemaVersion += 1) {
    const encoded = encodeM61Config({ ...config, schemaVersion });
    assert.equal(encoded.length, expectedSizes[schemaVersion]);
    const decoded = decodeM61Config(encoded);
    assert.equal(decoded.schemaVersion, schemaVersion);
    assert.equal(decoded.statusLedBrightnessPercent, 12);
    assert.equal(decoded.audioBufferLength, 48);
  }
});

test("performance warning follows the effective CPU profile", () => {
  assert.equal(usesElevatedCpuPerformance({ ...DEFAULT_CONFIG, manualCpuMhz: 400 }), false);
  assert.equal(usesElevatedCpuPerformance({ ...DEFAULT_CONFIG, cpuProfile: 3 }), false);
  assert.equal(usesElevatedCpuPerformance({ ...DEFAULT_CONFIG, cpuProfile: 3, manualCpuMhz: 384 }), true);
  assert.equal(usesElevatedCpuPerformance({ ...DEFAULT_CONFIG, cpuProfile: 1 }), true);
  assert.equal(usesElevatedCpuPerformance({ ...DEFAULT_CONFIG, cpuGovernor: 1 }), true);
});

test("an unrelated legacy config is rejected by magic", () => {
  const legacy = new Uint8Array(M61_CONFIG_BODY_SIZE);
  legacy[0] = 5;
  assert.throws(() => decodeM61Config(legacy), (error: unknown) => {
    return error instanceof M61ProtocolError && error.code === "invalidMagic";
  });
});

test("apply command contains one exact config body", () => {
  const report = makeM61Command(M61Command.ApplyConfig, config);
  assert.equal(report.length, M61_FEATURE_PAYLOAD_SIZE);
  assert.equal(report[0], M61Command.ApplyConfig);
  assert.deepEqual(decodeM61Config(report.slice(1)), config);
  assert.throws(() => makeM61Command(M61Command.ApplyConfig), M61ProtocolError);
});

test("telemetry preserves the RSSI and activity compatibility prefix", () => {
  const report = new Uint8Array([0xd6, 0x83, 1, 0x0f, 0x90, 0x01, 0x80, 0x01]);
  assert.deepEqual(decodeM61Telemetry(report), {
    rssi: -42,
    speakerActive: true,
    microphoneActive: true,
    version: 1,
    bluetoothConnected: true,
    usbConfigured: true,
    headphonesConnected: true,
    speakerStereo: true,
    currentCpuMhz: 400,
    requestedCpuMhz: 384,
    pairingActive: false,
    discoveryActive: false,
    savedController: false,
    configLoaded: false,
    usbSuspended: false,
    lastManagementCommand: 0,
    lastManagementError: 0,
    managementSequence: 0,
    usbInputDropped: 0,
    hostReportDropped: 0,
    audioIngressDropped: 0,
    hapticsQueueDropped: 0,
    speakerErrors: 0,
    microphoneErrors: 0,
    featureGetQueueDepth: 0,
    featureSetQueueDepth: 0,
    hapticsQueueDepth: 0,
    speakerQueueDepth: 0,
  });
});

test("telemetry v2 decodes management and health fields", () => {
  const report = new Uint8Array(45);
  report[0] = 0xf9;
  const payload = report.subarray(1);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  payload.set([0xb8, 0x80, 2, 0xf3, 0x40, 0x01, 0x40, 0x01, 1, M61Command.ForgetController]);
  view.setInt16(10, -107, true);
  [7, 11, 13, 17, 19, 23].forEach((value, index) => view.setUint32(12 + index * 4, value, true));
  view.setUint32(36, 29, true);
  payload.set([2, 3, 4, 5], 40);

  assert.deepEqual(decodeM61Telemetry(report), {
    rssi: -72,
    speakerActive: false,
    microphoneActive: false,
    version: 2,
    bluetoothConnected: true,
    usbConfigured: true,
    headphonesConnected: false,
    speakerStereo: false,
    currentCpuMhz: 320,
    requestedCpuMhz: 320,
    pairingActive: true,
    discoveryActive: true,
    savedController: true,
    configLoaded: true,
    usbSuspended: true,
    lastManagementCommand: M61Command.ForgetController,
    lastManagementError: -107,
    managementSequence: 7,
    usbInputDropped: 11,
    hostReportDropped: 13,
    audioIngressDropped: 17,
    hapticsQueueDropped: 19,
    speakerErrors: 23,
    microphoneErrors: 29,
    featureGetQueueDepth: 2,
    featureSetQueueDepth: 3,
    hapticsQueueDepth: 4,
    speakerQueueDepth: 5,
  });
});

test("English and Chinese product strings have identical keys", () => {
  assert.deepEqual(objectKeys(en), objectKeys(zh));
});

function objectKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" ? objectKeys(child, path) : [path];
  }).sort();
}
