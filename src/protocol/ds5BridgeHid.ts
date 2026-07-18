import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  encodeConfigBody,
} from "./config";
import {
  M61_COMMAND_REPORT_ID,
  M61_CONFIG_REPORT_ID,
  M61_FIRMWARE_REPORT_ID,
  M61_TELEMETRY_REPORT_ID,
  M61Command,
  decodeM61Telemetry,
  type M61Telemetry,
} from "./m61Management";

export const SONY_VENDOR_ID = 0x054c;
export const SUPPORTED_PRODUCT_IDS = [0x0ce6] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

const GENERIC_DESKTOP_USAGE_PAGE = 0x01;
const GAMEPAD_USAGE = 0x05;
const MANAGEMENT_RESULT_TIMEOUT_MS = 1_500;
const MANAGEMENT_RESULT_POLL_MS = 50;

export interface AudioActivityState {
  speakerActive: boolean;
  micActive: boolean;
}

export interface TelemetryReport {
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
    const report = await this.device.receiveFeatureReport(M61_CONFIG_REPORT_ID);
    return decodeConfigBody(report);
  }

  async readFirmwareVersion(): Promise<string> {
    await this.open();
    const report = await this.device.receiveFeatureReport(M61_FIRMWARE_REPORT_ID);
    return decodeFirmwareVersion(report);
  }

  async readTelemetry(): Promise<TelemetryReport> {
    await this.open();
    const report = await this.device.receiveFeatureReport(M61_TELEMETRY_REPORT_ID);
    return decodeTelemetryReport(report);
  }

  async applyConfig(config: ConfigBody): Promise<void> {
    await this.open();
    const body = encodeConfigBody(config);
    const report = commandReport(M61Command.ApplyConfig);
    report.set(body, 1);
    await this.sendManagedCommand(M61Command.ApplyConfig, report);
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(M61Command.SaveConfig);
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(
      M61_COMMAND_REPORT_ID,
      commandReport(M61Command.ReconnectUsb),
    );
  }

  async powerOffController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(M61Command.PowerOffController);
  }

  async pairController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(M61Command.PairController);
  }

  async disconnectController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(M61Command.DisconnectController);
  }

  async forgetController(): Promise<void> {
    await this.open();
    await this.sendManagedCommand(M61Command.ForgetController);
  }

  private async sendManagedCommand(command: number, report = commandReport(command)): Promise<void> {
    const before = await this.readTelemetry();
    await this.device.sendFeatureReport(M61_COMMAND_REPORT_ID, report);
    const deadline = performance.now() + MANAGEMENT_RESULT_TIMEOUT_MS;

    while (performance.now() < deadline) {
      const result = await this.readTelemetry();
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

export function getDeviceLabel(device: HIDDevice): string {
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

  if (bytes[0] === M61_FIRMWARE_REPORT_ID) {
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

function decodeTelemetryReport(source: ArrayBuffer | DataView | Uint8Array): TelemetryReport {
  const telemetry = decodeM61Telemetry(source);
  return {
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
