import {
  M61Capability,
  M61_CONFIG_BODY_SIZE,
  M61_FEATURE_PAYLOAD_SIZE,
  decodeM61Config,
  encodeM61Config,
  M61ProtocolError,
  type M61Config,
} from "./m61Management";

export const CONFIG_BODY_VERSION = 4;
export const CONFIG_BODY_SIZE = M61_CONFIG_BODY_SIZE;
export const FEATURE_REPORT_PAYLOAD_SIZE = M61_FEATURE_PAYLOAD_SIZE;
export type ConfigBody = M61Config;
export { M61ProtocolError as ConfigDecodeError };

export interface ConfigValidationIssue {
  field: keyof ConfigBody;
}

export const DEFAULT_CONFIG: ConfigBody = {
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
    M61Capability.UsbPollingRate,
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

export function validateConfig(config: ConfigBody): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  if (!Number.isInteger(config.capabilities) || config.capabilities < 0 || config.capabilities > 0xffff) {
    issues.push({ field: "capabilities" });
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
  return issues;
}

export function normalizeConfig(config: ConfigBody): ConfigBody {
  return {
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
  };
}

export function configsEqual(left: ConfigBody | null, right: ConfigBody | null): boolean {
  if (!left || !right) return left === right;
  return (
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
  );
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
