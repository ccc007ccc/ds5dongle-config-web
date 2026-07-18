import {
  M61Capability,
  M61_CONFIG_BODY_SIZE,
  M61_FEATURE_PAYLOAD_SIZE,
  decodeM61Config,
  encodeM61Config,
  M61ProtocolError,
  type M61Config,
} from "./m61Management.ts";

export const CONFIG_BODY_VERSION = 5;
export const CONFIG_BODY_SIZE = M61_CONFIG_BODY_SIZE;
export const FEATURE_REPORT_PAYLOAD_SIZE = M61_FEATURE_PAYLOAD_SIZE;
export type ConfigBody = M61Config;
export { M61ProtocolError as ConfigDecodeError };

export interface ConfigValidationIssue {
  field: keyof ConfigBody;
}

export const DEFAULT_CONFIG: ConfigBody = {
  schemaVersion: CONFIG_BODY_VERSION,
  capabilities:
    M61Capability.Microphone |
    M61Capability.SpeakerGate |
    M61Capability.SpeakerRoute |
    M61Capability.AutoReconnect |
    M61Capability.StatusLed |
    M61Capability.HapticsGain |
    M61Capability.Dvfs |
    M61Capability.Telemetry |
    M61Capability.IdlePowerOff |
    M61Capability.ControllerPowerOff |
    M61Capability.SuspendPowerOff |
    M61Capability.StickDeadzone |
    M61Capability.UsbPollingRate |
    M61Capability.StatusLedBrightness |
    M61Capability.AudioBufferLength,
  microphoneEnabled: false,
  speakerEnabled: true,
  autoReconnectEnabled: true,
  statusLedEnabled: true,
  speakerRoute: 0,
  cpuGovernor: 0,
  cpuProfile: 0,
  manualCpuMhz: 320,
  hapticsGainQ8: 0x0100,
  idleTimeoutMinutes: 0,
  powerOffOnUsbSuspend: false,
  leftStickDeadzonePercent: 0,
  rightStickDeadzonePercent: 0,
  usbPollingRateMode: 0,
  statusLedBrightnessPercent: 12,
  audioBufferLength: 48,
};

export function decodeConfigBody(source: ArrayBuffer | DataView | Uint8Array): ConfigBody {
  return decodeM61Config(source);
}

export function encodeConfigBody(config: ConfigBody): Uint8Array<ArrayBuffer> {
  return encodeM61Config(config);
}

export function hasCapability(config: ConfigBody, capability: number): boolean {
  return (config.capabilities & capability) === capability;
}

export function releaseDefaultsForDevice(current: ConfigBody): ConfigBody {
  const defaults = {
    ...DEFAULT_CONFIG,
    schemaVersion: current.schemaVersion,
    capabilities: current.capabilities,
  };
  const preserveUnlessSupported = <Key extends keyof ConfigBody>(
    capability: number,
    fields: Key[],
  ) => {
    if (hasCapability(current, capability)) return;
    for (const field of fields) {
      defaults[field] = current[field] as ConfigBody[Key];
    }
  };

  preserveUnlessSupported(M61Capability.Microphone, ["microphoneEnabled"]);
  preserveUnlessSupported(M61Capability.SpeakerGate, ["speakerEnabled"]);
  preserveUnlessSupported(M61Capability.SpeakerRoute, ["speakerRoute"]);
  preserveUnlessSupported(M61Capability.AutoReconnect, ["autoReconnectEnabled"]);
  preserveUnlessSupported(M61Capability.StatusLed, ["statusLedEnabled"]);
  preserveUnlessSupported(M61Capability.StatusLedBrightness, ["statusLedBrightnessPercent"]);
  preserveUnlessSupported(M61Capability.HapticsGain, ["hapticsGainQ8"]);
  preserveUnlessSupported(M61Capability.Dvfs, ["cpuGovernor", "cpuProfile", "manualCpuMhz"]);
  preserveUnlessSupported(M61Capability.IdlePowerOff, ["idleTimeoutMinutes"]);
  preserveUnlessSupported(M61Capability.SuspendPowerOff, ["powerOffOnUsbSuspend"]);
  preserveUnlessSupported(M61Capability.StickDeadzone, ["leftStickDeadzonePercent", "rightStickDeadzonePercent"]);
  preserveUnlessSupported(M61Capability.UsbPollingRate, ["usbPollingRateMode"]);
  preserveUnlessSupported(M61Capability.AudioBufferLength, ["audioBufferLength"]);
  return defaults;
}

export function validateConfig(config: ConfigBody): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  if (!Number.isInteger(config.capabilities) || config.capabilities < 0 || config.capabilities > 0xffff) {
    issues.push({ field: "capabilities" });
  }
  if (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1 || config.schemaVersion > CONFIG_BODY_VERSION) {
    issues.push({ field: "schemaVersion" });
  }
  if (!Number.isInteger(config.speakerRoute) || config.speakerRoute < 0 || config.speakerRoute > 2) {
    issues.push({ field: "speakerRoute" });
  }
  if (!Number.isInteger(config.cpuGovernor) || config.cpuGovernor < 0 || config.cpuGovernor > 1) {
    issues.push({ field: "cpuGovernor" });
  }
  if (!Number.isInteger(config.cpuProfile) || config.cpuProfile < 0 || config.cpuProfile > 3) {
    issues.push({ field: "cpuProfile" });
  }
  if (!Number.isInteger(config.manualCpuMhz) || config.manualCpuMhz < 320 || config.manualCpuMhz > 400) {
    issues.push({ field: "manualCpuMhz" });
  }
  if (!Number.isInteger(config.hapticsGainQ8) || config.hapticsGainQ8 < 0x0100 || config.hapticsGainQ8 > 0x0200) {
    issues.push({ field: "hapticsGainQ8" });
  }
  if (!Number.isInteger(config.idleTimeoutMinutes) || config.idleTimeoutMinutes < 0 || config.idleTimeoutMinutes > 60) {
    issues.push({ field: "idleTimeoutMinutes" });
  }
  if (!Number.isInteger(config.leftStickDeadzonePercent) || config.leftStickDeadzonePercent < 0 || config.leftStickDeadzonePercent > 30) {
    issues.push({ field: "leftStickDeadzonePercent" });
  }
  if (!Number.isInteger(config.rightStickDeadzonePercent) || config.rightStickDeadzonePercent < 0 || config.rightStickDeadzonePercent > 30) {
    issues.push({ field: "rightStickDeadzonePercent" });
  }
  if (!Number.isInteger(config.usbPollingRateMode) || config.usbPollingRateMode < 0 || config.usbPollingRateMode > 2) {
    issues.push({ field: "usbPollingRateMode" });
  }
  if (!Number.isInteger(config.statusLedBrightnessPercent) || config.statusLedBrightnessPercent < 1 || config.statusLedBrightnessPercent > 100) {
    issues.push({ field: "statusLedBrightnessPercent" });
  }
  if (!Number.isInteger(config.audioBufferLength) || config.audioBufferLength < 16 || config.audioBufferLength > 127) {
    issues.push({ field: "audioBufferLength" });
  }
  return issues;
}

export function normalizeConfig(config: ConfigBody): ConfigBody {
  return {
    schemaVersion: clampInteger(config.schemaVersion, 1, CONFIG_BODY_VERSION),
    capabilities: clampInteger(config.capabilities, 0, 0xffff),
    microphoneEnabled: Boolean(config.microphoneEnabled),
    speakerEnabled: Boolean(config.speakerEnabled),
    autoReconnectEnabled: Boolean(config.autoReconnectEnabled),
    statusLedEnabled: Boolean(config.statusLedEnabled),
    speakerRoute: clampInteger(config.speakerRoute, 0, 2) as ConfigBody["speakerRoute"],
    cpuGovernor: clampInteger(config.cpuGovernor, 0, 1) as ConfigBody["cpuGovernor"],
    cpuProfile: clampInteger(config.cpuProfile, 0, 3) as ConfigBody["cpuProfile"],
    manualCpuMhz: clampInteger(config.manualCpuMhz, 320, 400),
    hapticsGainQ8: clampInteger(config.hapticsGainQ8, 0x0100, 0x0200),
    idleTimeoutMinutes: clampInteger(config.idleTimeoutMinutes, 0, 60),
    powerOffOnUsbSuspend: Boolean(config.powerOffOnUsbSuspend),
    leftStickDeadzonePercent: clampInteger(config.leftStickDeadzonePercent, 0, 30),
    rightStickDeadzonePercent: clampInteger(config.rightStickDeadzonePercent, 0, 30),
    usbPollingRateMode: clampInteger(config.usbPollingRateMode, 0, 2) as ConfigBody["usbPollingRateMode"],
    statusLedBrightnessPercent: clampInteger(config.statusLedBrightnessPercent, 1, 100),
    audioBufferLength: clampInteger(config.audioBufferLength, 16, 127),
  };
}

export function configsEqual(left: ConfigBody | null, right: ConfigBody | null): boolean {
  if (!left || !right) return left === right;
  return (
    left.schemaVersion === right.schemaVersion &&
    left.capabilities === right.capabilities &&
    left.microphoneEnabled === right.microphoneEnabled &&
    left.speakerEnabled === right.speakerEnabled &&
    left.autoReconnectEnabled === right.autoReconnectEnabled &&
    left.statusLedEnabled === right.statusLedEnabled &&
    left.speakerRoute === right.speakerRoute &&
    left.cpuGovernor === right.cpuGovernor &&
    left.cpuProfile === right.cpuProfile &&
    left.manualCpuMhz === right.manualCpuMhz &&
    left.hapticsGainQ8 === right.hapticsGainQ8
    && left.idleTimeoutMinutes === right.idleTimeoutMinutes
    && left.powerOffOnUsbSuspend === right.powerOffOnUsbSuspend
    && left.leftStickDeadzonePercent === right.leftStickDeadzonePercent
    && left.rightStickDeadzonePercent === right.rightStickDeadzonePercent
    && left.usbPollingRateMode === right.usbPollingRateMode
    && left.statusLedBrightnessPercent === right.statusLedBrightnessPercent
    && left.audioBufferLength === right.audioBufferLength
  );
}

export function usesElevatedCpuPerformance(config: ConfigBody): boolean {
  return config.cpuGovernor !== 0 ||
    config.cpuProfile === 1 ||
    config.cpuProfile === 2 ||
    (config.cpuProfile === 3 && config.manualCpuMhz > 320);
}

export function fieldIssue(
  issues: ConfigValidationIssue[],
  field: keyof ConfigBody,
): ConfigValidationIssue | undefined {
  return issues.find((issue) => issue.field === field);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
