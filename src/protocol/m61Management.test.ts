import assert from "node:assert/strict";
import test from "node:test";
import { en } from "../i18n/locales/en.ts";
import { zh } from "../i18n/locales/zh.ts";
import {
  M61Capability,
  M61Command,
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
};

test("M61 config round trips with and without report ID", () => {
  const encoded = encodeM61Config(config);
  assert.deepEqual(decodeM61Config(encoded), config);
  const withId = new Uint8Array(encoded.length + 1);
  withId[0] = M61_CONFIG_REPORT_ID;
  withId.set(encoded, 1);
  assert.deepEqual(decodeM61Config(withId), config);
});

test("an unrelated legacy config is rejected by magic", () => {
  const legacy = new Uint8Array(19);
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
