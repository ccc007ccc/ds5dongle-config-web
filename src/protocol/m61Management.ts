export const M61_CONFIG_REPORT_ID = 0xf7;
export const M61_COMMAND_REPORT_ID = 0xf6;
export const M61_FIRMWARE_REPORT_ID = 0xf8;
export const M61_TELEMETRY_REPORT_ID = 0xf9;
export const M61_FEATURE_PAYLOAD_SIZE = 63;
export const M61_CONFIG_SCHEMA_VERSION = 3;
export const M61_CONFIG_BODY_SIZE = 20;

const MAGIC = new Uint8Array([0x4d, 0x36, 0x31, 0x43]); // M61C

export const M61Command = {
  ApplyConfig: 0x01,
  SaveConfig: 0x02,
  ReconnectUsb: 0x03,
  PowerOffController: 0x04,
  PairController: 0x05,
  DisconnectController: 0x06,
  ForgetController: 0x07,
} as const;
export type M61CommandValue = (typeof M61Command)[keyof typeof M61Command];

export const M61Capability = {
  Microphone: 1 << 0,
  SpeakerGate: 1 << 1,
  SpeakerRoute: 1 << 2,
  AutoReconnect: 1 << 3,
  StatusLed: 1 << 4,
  HapticsGain: 1 << 5,
  Dvfs: 1 << 6,
  Telemetry: 1 << 7,
  IdlePowerOff: 1 << 8,
  ControllerPowerOff: 1 << 9,
  SuspendPowerOff: 1 << 10,
  StickDeadzone: 1 << 11,
} as const;

export type M61SpeakerRoute = 0 | 1 | 2;
export type M61CpuGovernor = 0 | 1;
export type M61CpuProfile = 0 | 1 | 2 | 3;

export interface M61Config {
  capabilities: number;
  microphoneEnabled: boolean;
  speakerEnabled: boolean;
  autoReconnectEnabled: boolean;
  statusLedEnabled: boolean;
  speakerRoute: M61SpeakerRoute;
  cpuGovernor: M61CpuGovernor;
  cpuProfile: M61CpuProfile;
  manualCpuMhz: number;
  hapticsGainQ8: number;
  idleTimeoutMinutes: number;
  powerOffOnUsbSuspend: boolean;
  leftStickDeadzonePercent: number;
  rightStickDeadzonePercent: number;
}

export interface M61Telemetry {
  rssi: number | null;
  speakerActive: boolean;
  microphoneActive: boolean;
  version: number | null;
  bluetoothConnected: boolean;
  usbConfigured: boolean;
  headphonesConnected: boolean;
  speakerStereo: boolean;
  currentCpuMhz: number | null;
  requestedCpuMhz: number | null;
  pairingActive: boolean;
  discoveryActive: boolean;
  savedController: boolean;
  configLoaded: boolean;
  usbSuspended: boolean;
  lastManagementCommand: number;
  lastManagementError: number;
  managementSequence: number;
  usbInputDropped: number;
  hostReportDropped: number;
  audioIngressDropped: number;
  hapticsQueueDropped: number;
  speakerErrors: number;
  microphoneErrors: number;
  featureGetQueueDepth: number;
  featureSetQueueDepth: number;
  hapticsQueueDepth: number;
  speakerQueueDepth: number;
}

export class M61ProtocolError extends Error {
  readonly code: "invalidLength" | "invalidMagic" | "versionMismatch" | "invalidConfig";
  readonly details: Record<string, unknown>;

  constructor(
    code: "invalidLength" | "invalidMagic" | "versionMismatch" | "invalidConfig",
    details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "M61ProtocolError";
    this.code = code;
    this.details = details;
  }
}

export function encodeM61Config(config: M61Config): Uint8Array<ArrayBuffer> {
  validateM61Config(config);
  const bytes = new Uint8Array(new ArrayBuffer(M61_CONFIG_BODY_SIZE));
  bytes.set(MAGIC, 0);
  const view = new DataView(bytes.buffer);
  view.setUint8(4, M61_CONFIG_SCHEMA_VERSION);
  view.setUint8(5, M61_CONFIG_BODY_SIZE);
  view.setUint16(6, config.capabilities, true);
  view.setUint8(8, configFlags(config));
  view.setUint8(9, config.speakerRoute);
  view.setUint8(10, config.cpuGovernor);
  view.setUint8(11, config.cpuProfile);
  view.setUint16(12, config.manualCpuMhz, true);
  view.setUint16(14, config.hapticsGainQ8, true);
  view.setUint8(16, config.idleTimeoutMinutes);
  view.setUint8(17, config.powerOffOnUsbSuspend ? 0x01 : 0x00);
  view.setUint8(18, config.leftStickDeadzonePercent);
  view.setUint8(19, config.rightStickDeadzonePercent);
  return bytes;
}

export function decodeM61Config(source: ArrayBuffer | DataView | Uint8Array): M61Config {
  const bytes = toUint8Array(source);
  const offset = reportPayloadOffset(bytes, M61_CONFIG_REPORT_ID);
  if (bytes.byteLength - offset < M61_CONFIG_BODY_SIZE) {
    throw new M61ProtocolError("invalidLength", {
      actual: bytes.byteLength - offset,
      expected: M61_CONFIG_BODY_SIZE,
    });
  }
  if (!MAGIC.every((value, index) => bytes[offset + index] === value)) {
    throw new M61ProtocolError("invalidMagic");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, M61_CONFIG_BODY_SIZE);
  const version = view.getUint8(4);
  if (version !== M61_CONFIG_SCHEMA_VERSION) {
    throw new M61ProtocolError("versionMismatch", {
      actual: version,
      expected: M61_CONFIG_SCHEMA_VERSION,
    });
  }
  if (view.getUint8(5) !== M61_CONFIG_BODY_SIZE) {
    throw new M61ProtocolError("invalidLength", {
      actual: view.getUint8(5),
      expected: M61_CONFIG_BODY_SIZE,
    });
  }
  const flags = view.getUint8(8);
  const config: M61Config = {
    capabilities: view.getUint16(6, true),
    microphoneEnabled: Boolean(flags & 0x01),
    speakerEnabled: Boolean(flags & 0x02),
    autoReconnectEnabled: Boolean(flags & 0x04),
    statusLedEnabled: Boolean(flags & 0x08),
    speakerRoute: view.getUint8(9) as M61SpeakerRoute,
    cpuGovernor: view.getUint8(10) as M61CpuGovernor,
    cpuProfile: view.getUint8(11) as M61CpuProfile,
    manualCpuMhz: view.getUint16(12, true),
    hapticsGainQ8: view.getUint16(14, true),
    idleTimeoutMinutes: view.getUint8(16),
    powerOffOnUsbSuspend: Boolean(view.getUint8(17) & 0x01),
    leftStickDeadzonePercent: view.getUint8(18),
    rightStickDeadzonePercent: view.getUint8(19),
  };
  validateM61Config(config);
  return config;
}

export function makeM61Command(command: M61CommandValue, config?: M61Config): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(new ArrayBuffer(M61_FEATURE_PAYLOAD_SIZE));
  report[0] = command;
  if (command === M61Command.ApplyConfig) {
    if (!config) {
      throw new M61ProtocolError("invalidConfig", { reason: "apply requires config" });
    }
    report.set(encodeM61Config(config), 1);
  } else if (config) {
    throw new M61ProtocolError("invalidConfig", { reason: "config is only valid for apply" });
  }
  return report;
}

export function decodeM61Telemetry(source: ArrayBuffer | DataView | Uint8Array): M61Telemetry {
  const bytes = toUint8Array(source);
  const offset = reportPayloadOffset(bytes, M61_TELEMETRY_REPORT_ID);
  const rssiByte = bytes[offset];
  const activity = bytes[offset + 1];
  const version = bytes[offset + 2];
  const state = bytes[offset + 3];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const validActivity = activity !== undefined && (activity & 0x80) !== 0;
  return {
    rssi: rssiByte === undefined || rssiByte === 0x7f ? null : toInt8(rssiByte),
    speakerActive: validActivity && Boolean(activity & 0x02),
    microphoneActive: validActivity && Boolean(activity & 0x01),
    version: version ?? null,
    bluetoothConnected: state !== undefined && Boolean(state & 0x01),
    usbConfigured: state !== undefined && Boolean(state & 0x02),
    headphonesConnected: state !== undefined && Boolean(state & 0x04),
    speakerStereo: state !== undefined && Boolean(state & 0x08),
    currentCpuMhz: bytes.byteLength - offset >= 6 ? view.getUint16(offset + 4, true) : null,
    requestedCpuMhz: bytes.byteLength - offset >= 8 ? view.getUint16(offset + 6, true) : null,
    pairingActive: state !== undefined && Boolean(state & 0x10),
    discoveryActive: state !== undefined && Boolean(state & 0x20),
    savedController: state !== undefined && Boolean(state & 0x40),
    configLoaded: state !== undefined && Boolean(state & 0x80),
    usbSuspended: bytes.byteLength - offset >= 9 && Boolean(view.getUint8(offset + 8) & 0x01),
    lastManagementCommand: bytes.byteLength - offset >= 10 ? view.getUint8(offset + 9) : 0,
    lastManagementError: bytes.byteLength - offset >= 12 ? view.getInt16(offset + 10, true) : 0,
    managementSequence: readUint32(view, bytes.byteLength - offset, offset + 12, 16),
    usbInputDropped: readUint32(view, bytes.byteLength - offset, offset + 16, 20),
    hostReportDropped: readUint32(view, bytes.byteLength - offset, offset + 20, 24),
    audioIngressDropped: readUint32(view, bytes.byteLength - offset, offset + 24, 28),
    hapticsQueueDropped: readUint32(view, bytes.byteLength - offset, offset + 28, 32),
    speakerErrors: readUint32(view, bytes.byteLength - offset, offset + 32, 36),
    microphoneErrors: readUint32(view, bytes.byteLength - offset, offset + 36, 40),
    featureGetQueueDepth: bytes.byteLength - offset >= 41 ? view.getUint8(offset + 40) : 0,
    featureSetQueueDepth: bytes.byteLength - offset >= 42 ? view.getUint8(offset + 41) : 0,
    hapticsQueueDepth: bytes.byteLength - offset >= 43 ? view.getUint8(offset + 42) : 0,
    speakerQueueDepth: bytes.byteLength - offset >= 44 ? view.getUint8(offset + 43) : 0,
  };
}

function readUint32(view: DataView, available: number, offset: number, required: number): number {
  return available >= required ? view.getUint32(offset, true) : 0;
}

export function validateM61Config(config: M61Config): void {
  const valid =
    Number.isInteger(config.capabilities) &&
    config.capabilities >= 0 &&
    config.capabilities <= 0xffff &&
    [config.microphoneEnabled, config.speakerEnabled, config.autoReconnectEnabled, config.statusLedEnabled, config.powerOffOnUsbSuspend].every(
      (value) => typeof value === "boolean",
    ) &&
    Number.isInteger(config.speakerRoute) &&
    config.speakerRoute >= 0 &&
    config.speakerRoute <= 2 &&
    Number.isInteger(config.cpuGovernor) &&
    config.cpuGovernor >= 0 &&
    config.cpuGovernor <= 1 &&
    Number.isInteger(config.cpuProfile) &&
    config.cpuProfile >= 0 &&
    config.cpuProfile <= 3 &&
    Number.isInteger(config.manualCpuMhz) &&
    config.manualCpuMhz >= 320 &&
    config.manualCpuMhz <= 400 &&
    Number.isInteger(config.hapticsGainQ8) &&
    config.hapticsGainQ8 >= 0x0100 &&
    config.hapticsGainQ8 <= 0x0200 &&
    Number.isInteger(config.idleTimeoutMinutes) &&
    config.idleTimeoutMinutes >= 0 &&
    config.idleTimeoutMinutes <= 60 &&
    Number.isInteger(config.leftStickDeadzonePercent) &&
    config.leftStickDeadzonePercent >= 0 &&
    config.leftStickDeadzonePercent <= 30 &&
    Number.isInteger(config.rightStickDeadzonePercent) &&
    config.rightStickDeadzonePercent >= 0 &&
    config.rightStickDeadzonePercent <= 30;
  if (!valid) {
    throw new M61ProtocolError("invalidConfig");
  }
}

function configFlags(config: M61Config): number {
  return (
    (config.microphoneEnabled ? 0x01 : 0) |
    (config.speakerEnabled ? 0x02 : 0) |
    (config.autoReconnectEnabled ? 0x04 : 0) |
    (config.statusLedEnabled ? 0x08 : 0)
  );
}

function reportPayloadOffset(bytes: Uint8Array, reportId: number): number {
  return bytes[0] === reportId ? 1 : 0;
}

function toInt8(value: number): number {
  return value > 0x7f ? value - 0x100 : value;
}

function toUint8Array(source: ArrayBuffer | DataView | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) return source;
  if (source instanceof DataView) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return new Uint8Array(source);
}
