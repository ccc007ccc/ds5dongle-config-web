import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  encodeConfigBody,
} from "./config";
import { decodeM61Telemetry, type M61Telemetry } from "./m61Management";

export const SONY_VENDOR_ID = 0x054c;
export const SUPPORTED_PRODUCT_IDS = [0x0ce6] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

const GENERIC_DESKTOP_USAGE_PAGE = 0x01;
const GAMEPAD_USAGE = 0x05;
const REPORT_SET_CONFIG = 0xf6;
const REPORT_GET_CONFIG = 0xf7;
const REPORT_GET_FIRMWARE_VERSION = 0xf8;
const REPORT_GET_SIGNAL_STRENGTH = 0xf9;
const CMD_UPDATE_CONFIG = 0x01;
const CMD_SAVE_TO_FLASH = 0x02;
const CMD_RECONNECT_USB = 0x03;
const CMD_POWER_OFF_CONTROLLER = 0x04;
const CMD_PAIR_CONTROLLER = 0x05;
const CMD_DISCONNECT_CONTROLLER = 0x06;
const CMD_FORGET_CONTROLLER = 0x07;
const MANAGEMENT_RESULT_TIMEOUT_MS = 1_500;
const MANAGEMENT_RESULT_POLL_MS = 50;

export interface AudioActivityState {
  speakerActive: boolean;
  micActive: boolean;
}

export interface SignalStrengthReport {
  rssi: number | null;
  audioActivity: AudioActivityState | null;
  telemetry: M61Telemetry;
}

export class Ds5BridgeHidClient {
  constructor(public readonly device: HIDDevice) {}

  static isSupportedDevice(device: HIDDevice): boolean {
    return (
      device.vendorId === SONY_VENDOR_ID &&
      SUPPORTED_PRODUCT_IDS.includes(device.productId as 0x0ce6) &&
      device.collections.some(isGamepadCollection)
    );
  }

  static async requestDevice(): Promise<Ds5BridgeHidClient> {
    const hid = getHid();
    const devices = await hid.requestDevice({
      filters: SUPPORTED_PRODUCT_IDS.map((productId) => ({
        vendorId: SONY_VENDOR_ID,
        productId,
        usagePage: GENERIC_DESKTOP_USAGE_PAGE,
        usage: GAMEPAD_USAGE,
      })),
    });

    const device = devices.find(Ds5BridgeHidClient.isSupportedDevice);
    if (!device) {
      throw new Error(NO_DEVICE_SELECTED_ERROR);
    }

    return new Ds5BridgeHidClient(device);
  }

  static async authorizedDevices(): Promise<HIDDevice[]> {
    const devices = await getHid().getDevices();
    return devices.filter(Ds5BridgeHidClient.isSupportedDevice);
  }

  async open(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }
  }

  async close(): Promise<void> {
    if (this.device.opened) {
      await this.device.close();
    }
  }

  async readConfig(): Promise<ConfigBody> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_CONFIG);
    return decodeConfigBody(report);
  }

  async readFirmwareVersion(): Promise<string> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_FIRMWARE_VERSION);
    return decodeFirmwareVersion(report);
  }

  async readSignalStrength(): Promise<SignalStrengthReport> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_SIGNAL_STRENGTH);
    return decodeSignalStrength(report);
  }

  async applyConfig(config: ConfigBody): Promise<void> {
    await this.open();
    const body = encodeConfigBody(config);
    const report = commandReport(CMD_UPDATE_CONFIG);
    report.set(body, 1);
    await this.sendManagedCommand(CMD_UPDATE_CONFIG, report);
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(CMD_SAVE_TO_FLASH);
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_RECONNECT_USB));
  }

  async powerOffController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(CMD_POWER_OFF_CONTROLLER);
  }

  async pairController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(CMD_PAIR_CONTROLLER);
  }

  async disconnectController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(CMD_DISCONNECT_CONTROLLER);
  }

  async forgetController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(CMD_FORGET_CONTROLLER);
  }

  private async sendManagedCommand(command: number, report = commandReport(command)): Promise<void> {
    const before = await this.readSignalStrength();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, report);
    const deadline = performance.now() + MANAGEMENT_RESULT_TIMEOUT_MS;

    while (performance.now() < deadline) {
      const result = await this.readSignalStrength();
      if (result.telemetry.managementSequence !== before.telemetry.managementSequence &&
          result.telemetry.lastManagementCommand === command) {
        if (result.telemetry.lastManagementError !== 0) {
          throw new Error(
            `M61 command 0x${command.toString(16).padStart(2, "0")} failed (${result.telemetry.lastManagementError})`,
          );
        }
        return;
      }
      await delay(MANAGEMENT_RESULT_POLL_MS);
    }

    throw new Error(`M61 command 0x${command.toString(16).padStart(2, "0")} timed out`);
  }
}

export function webHidAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.hid);
}

export function getDeviceLabel(device: HIDDevice | null): string {
  if (!device) {
    return "No device";
  }

  const productId = device.productId.toString(16).padStart(4, "0").toUpperCase();
  return `${device.productName || "M61 DualSense Dongle"} · 054C:${productId}`;
}

function getHid(): HID {
  if (!navigator.hid) {
    throw new Error(WEBHID_UNAVAILABLE_ERROR);
  }

  return navigator.hid;
}

function isGamepadCollection(collection: HIDCollectionInfo): boolean {
  return collection.usagePage === GENERIC_DESKTOP_USAGE_PAGE && collection.usage === GAMEPAD_USAGE;
}

function commandReport(command: number): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
  report[0] = command;
  return report;
}

function decodeFirmwareVersion(source: ArrayBuffer | DataView | Uint8Array): string {
  const bytes = trimTrailingZeros(toUint8Array(source));
  const candidates = [bytes];

  if (bytes[0] === REPORT_GET_FIRMWARE_VERSION) {
    candidates.push(bytes.slice(1));
  }

  for (const candidate of candidates) {
    const version = decodePrintableString(candidate);
    if (version) {
      return version;
    }
  }

  return bytes.length > 0 ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ") : "";
}

function decodePrintableString(bytes: Uint8Array): string {
  const text = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  return /^[\x20-\x7e]+$/.test(text) ? text : "";
}

function decodeSignalStrength(source: ArrayBuffer | DataView | Uint8Array): SignalStrengthReport {
  const telemetry = decodeM61Telemetry(source);
  return {
    rssi: telemetry.rssi,
    audioActivity: {
      speakerActive: telemetry.speakerActive,
      micActive: telemetry.microphoneActive,
    },
    telemetry,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1;
  }

  return bytes.slice(0, end);
}

function toUint8Array(source: ArrayBuffer | DataView | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) {
    return source;
  }

  if (source instanceof DataView) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  return new Uint8Array(source);
}
