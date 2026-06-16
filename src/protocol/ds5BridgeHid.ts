import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  encodeConfigBody,
} from "./config";

export const SONY_VENDOR_ID = 0x054c;
export const SUPPORTED_PRODUCT_IDS = [0x0ce6, 0x0df2] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

const REPORT_SET_CONFIG = 0xf6;
const REPORT_GET_CONFIG = 0xf7;
const REPORT_GET_FIRMWARE_VERSION = 0xf8;
const REPORT_GET_SIGNAL_STRENGTH = 0xf9;
const CMD_UPDATE_CONFIG = 0x01;
const CMD_SAVE_TO_FLASH = 0x02;
const CMD_RECONNECT_USB = 0x03;
const CMD_GET_CONFIG_FIELD = 0x04;
const CMD_GET_FIRMWARE_VERSION = 0x05;
const CMD_GET_SIGNAL_STATUS = 0x06;
const CONFIG_IO_RETRY_COUNT = 3;
const CONFIG_IO_RETRY_DELAY_MS = 50;

export interface SignalStatus {
  rssi: number | null;
  micActive: boolean | null;
  speakerActive: boolean | null;
}

export interface ConfigVersionWarning {
  actual: number;
  expected: number;
}

export interface ConfigReadResult {
  config: ConfigBody;
  versionWarning: ConfigVersionWarning | null;
}

export class Ds5BridgeHidClient {
  constructor(public readonly device: HIDDevice) {}

  static isSupportedDevice(device: HIDDevice): boolean {
    return device.vendorId === SONY_VENDOR_ID && SUPPORTED_PRODUCT_IDS.includes(device.productId as 0x0ce6 | 0x0df2);
  }

  static async requestDevice(): Promise<Ds5BridgeHidClient> {
    const hid = getHid();
    const devices = await hid.requestDevice({
      filters: SUPPORTED_PRODUCT_IDS.map((productId) => ({
        vendorId: SONY_VENDOR_ID,
        productId,
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

  async readConfig(): Promise<ConfigReadResult> {
    await this.open();
    const version = await this.readConfigValue(0x00, (bytes) => readUint8ConfigField(bytes, 0x00));
    const versionWarning =
      version === CONFIG_BODY_VERSION
        ? null
        : {
            actual: version,
            expected: CONFIG_BODY_VERSION,
          };

    const entries: Array<[keyof ConfigBody, ConfigBody[keyof ConfigBody]]> = [];
    for (const field of CONFIG_FIELD_SPECS) {
      entries.push([field.key, await this.readConfigValue(field.fieldId, field.decode)]);
    }

    const config = Object.fromEntries(entries) as unknown as ConfigBody;
    const issues = validateConfig(config);
    if (issues.length > 0) {
      throw new ConfigDecodeError("invalidConfig", {
        issues: issues.map((issue) => issue.field),
      });
    }

    return { config, versionWarning };
  }

  async readFirmwareVersion(): Promise<string> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_FIRMWARE_VERSION);
    return decodeFirmwareVersion(report);
  }

  async readSignalStatus(): Promise<SignalStatus> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_SIGNAL_STRENGTH);
    return decodeSignalStatus(report);
  }

  async applyConfig(config: ConfigBody): Promise<void> {
    await this.open();
    const nextConfig = normalizeConfig(config);
    const issues = validateConfig(nextConfig);

    if (issues.length > 0) {
      throw new Error(`Invalid config fields: ${issues.map((issue) => issue.field).join(", ")}`);
    }

    for (const field of changedConfigFields(nextConfig, previousConfig)) {
      await this.writeConfigField(field, field.encode(nextConfig));
    }
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_SAVE_TO_FLASH));
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.enqueue(() => this.sendCommand(CMD_RECONNECT_USB));
  }

  // Run an async task with exclusive access to the command/response reports.
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.commandLock.then(task, task);
    this.commandLock = run.then(() => undefined, () => undefined);
    return run;
  }

  private exchange(command: number, payload?: Uint8Array): Promise<Uint8Array> {
    return this.enqueue(() => this.exchangeUnlocked(command, payload));
  }

  private readConfigValue<Value>(
    fieldId: number,
    decode: (bytes: Uint8Array) => Value,
  ): Promise<Value> {
    return this.enqueue(() =>
      withRetries(async () => decode(await this.readConfigFieldUnlocked(fieldId)), CONFIG_IO_RETRY_COUNT),
    );
  }

  private async readConfigFieldUnlocked(fieldId: number): Promise<Uint8Array> {
    const response = await this.exchangeUnlocked(CMD_GET_CONFIG_FIELD, byte(fieldId));
    if (response.byteLength < 1 || response[0] !== (fieldId & 0xff)) {
      const actual = response.byteLength > 0 ? response[0] : null;
      throw new Error(
        `Unexpected config field response: requested 0x${fieldId.toString(16).padStart(2, "0")}, got ${
          actual === null ? "empty" : `0x${actual.toString(16).padStart(2, "0")}`
        }`,
      );
    }

    return response.slice(1);
  }

  private writeConfigField(field: ConfigFieldSpec, value: Uint8Array): Promise<void> {
    const payload = new Uint8Array(new ArrayBuffer(value.byteLength + 1));
    payload[0] = field.fieldId;
    payload.set(value, 1);

    return this.enqueue(() =>
      withRetries(async () => {
        const response = await this.exchangeUnlocked(CMD_UPDATE_CONFIG_FIELD, payload);

        if (response[0] !== 0x00) {
          throw new Error(`Device rejected config field 0x${field.fieldId.toString(16).padStart(2, "0")}`);
        }
      }, CONFIG_IO_RETRY_COUNT),
    );
  }

  private async exchangeUnlocked(command: number, payload?: Uint8Array): Promise<Uint8Array> {
    await this.sendCommand(command, payload);
    return this.readCommandResponse(command);
  }

  private async sendCommand(command: number, payload?: Uint8Array): Promise<void> {
    await this.device.sendFeatureReport(REPORT_COMMAND, commandReport(command, payload));
  }

  private async readCommandResponse(command: number): Promise<Uint8Array> {
    const report = await this.device.receiveFeatureReport(REPORT_RESPONSE);
    return commandResponsePayload(report, command);
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
  return `${device.productName || "DS5 Bridge"} · 054C:${productId}`;
}

function getHid(): HID {
  if (!navigator.hid) {
    throw new Error(WEBHID_UNAVAILABLE_ERROR);
  }

  return navigator.hid;
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

function decodeSignalStatus(source: ArrayBuffer | DataView | Uint8Array): SignalStatus {
  const bytes = toUint8Array(source);
  const offsets = bytes[0] === REPORT_GET_SIGNAL_STRENGTH ? [1, 0] : [0, 1];

  for (const offset of offsets) {
    if (offset >= bytes.length) {
      continue;
    }

    const rssi = decodeRssiByte(bytes[offset]);
    if (rssi === null) {
      continue;
    }

    return previousConfig[field.key] !== config[field.key];
  });
}

async function withRetries<T>(task: () => Promise<T>, retryCount: number): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (cause) {
      if (attempt >= retryCount) {
        throw cause;
      }

      await delay(CONFIG_IO_RETRY_DELAY_MS);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function byte(value: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([value & 0xff]);
}

function boolByte(value: boolean): Uint8Array<ArrayBuffer> {
  return byte(value ? 1 : 0);
}

function float32Bytes(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(4));
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return bytes;
}

    return {
      rssi,
      micActive: hasAudioFlags ? (flags & 0x01) === 0x01 : null,
      speakerActive: hasAudioFlags ? (flags & 0x02) === 0x02 : null,
    };
  }

  return { rssi: null, micActive: null, speakerActive: null };
}

function decodeRssiByte(byte: number): number | null {
  const value = toInt8(byte);
  return value >= -128 && value <= 0 ? value : null;
}

function toInt8(byte: number): number {
  return byte > 0x7f ? byte - 0x100 : byte;
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
