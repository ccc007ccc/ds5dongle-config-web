import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  normalizeConfig,
  validateConfig,
} from "./config";

export const SONY_VENDOR_ID = 0x054c;
export const SUPPORTED_PRODUCT_IDS = [0x0ce6, 0x0df2] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

const REPORT_COMMAND = 0x80;
const REPORT_RESPONSE = 0x81;
const COMMAND_PREFIX = 0x66;
const CMD_UPDATE_CONFIG_FIELD = 0x01;
const CMD_SAVE_TO_FLASH = 0x02;
const CMD_RECONNECT_USB = 0x03;
const CMD_GET_CONFIG = 0x04;
const CMD_GET_FIRMWARE_VERSION = 0x05;
const CMD_GET_SIGNAL_STATUS = 0x06;
const CMD_REBOOT_BOOTLOADER = 0x07;

export interface SignalStatus {
  rssi: number | null;
  micActive: boolean | null;
  speakerActive: boolean | null;
}

export class Ds5BridgeHidClient {
  constructor(public readonly device: HIDDevice) {}

  // Serializes command/response exchanges. WebHID does not serialize feature
  // reports across call sites, so without this the periodic signal poll can
  // interleave with a config apply and read an empty/crossed 0x81 response.
  private commandLock: Promise<unknown> = Promise.resolve();

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

  async readConfig(): Promise<ConfigBody> {
    await this.open();
    return decodeConfigBody(await this.exchange(CMD_GET_CONFIG));
  }

  async readFirmwareVersion(): Promise<string> {
    await this.open();
    return decodeFirmwareVersion(await this.exchange(CMD_GET_FIRMWARE_VERSION));
  }

  async readSignalStatus(): Promise<SignalStatus> {
    await this.open();
    return decodeSignalStatus(await this.exchange(CMD_GET_SIGNAL_STATUS));
  }

  async applyConfig(config: ConfigBody, previousConfig: ConfigBody | null = null): Promise<void> {
    await this.open();
    const nextConfig = normalizeConfig(config);
    const issues = validateConfig(nextConfig);

    if (issues.length > 0) {
      throw new Error(`Invalid config fields: ${issues.map((issue) => issue.field).join(", ")}`);
    }

    for (const field of changedConfigFields(nextConfig, previousConfig)) {
      const value = field.encode(nextConfig);
      const payload = new Uint8Array(new ArrayBuffer(value.byteLength + 1));
      payload[0] = field.fieldId;
      payload.set(value, 1);
      const response = await this.exchange(CMD_UPDATE_CONFIG_FIELD, payload);

      if (response[0] !== 0x00) {
        throw new Error(`Device rejected config field 0x${field.fieldId.toString(16).padStart(2, "0")}`);
      }
    }
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.enqueue(() => this.sendCommand(CMD_SAVE_TO_FLASH));
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.enqueue(() => this.sendCommand(CMD_RECONNECT_USB));
  }

  async rebootToBootloader(): Promise<void> {
    await this.open();
    await this.enqueue(() => this.sendCommand(CMD_REBOOT_BOOTLOADER));
  }

  // Run an async task with exclusive access to the command/response reports.
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.commandLock.then(task, task);
    this.commandLock = run.then(() => undefined, () => undefined);
    return run;
  }

  private exchange(command: number, payload?: Uint8Array): Promise<Uint8Array> {
    return this.enqueue(async () => {
      await this.sendCommand(command, payload);
      return this.readCommandResponse(command);
    });
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

interface ConfigFieldSpec {
  key: keyof ConfigBody;
  fieldId: number;
  encode: (config: ConfigBody) => Uint8Array<ArrayBuffer>;
  equals?: (left: ConfigBody, right: ConfigBody) => boolean;
}

const CONFIG_FIELD_SPECS: ConfigFieldSpec[] = [
  {
    key: "hapticsGain",
    fieldId: 0x01,
    encode: (config) => float32Bytes(config.hapticsGain),
    equals: (left, right) => Math.abs(left.hapticsGain - right.hapticsGain) < 0.001,
  },
  { key: "speakerVolume", fieldId: 0x02, encode: (config) => byte(config.speakerVolume) },
  { key: "headsetVolume", fieldId: 0x03, encode: (config) => byte(config.headsetVolume) },
  {
    key: "syncSpeakerHeadsetVolume",
    fieldId: 0x04,
    encode: (config) => boolByte(config.syncSpeakerHeadsetVolume),
  },
  { key: "speakerGain", fieldId: 0x05, encode: (config) => byte(config.speakerGain) },
  { key: "inactiveTime", fieldId: 0x06, encode: (config) => byte(config.inactiveTime) },
  {
    key: "disableInactiveDisconnect",
    fieldId: 0x07,
    encode: (config) => boolByte(config.disableInactiveDisconnect),
  },
  { key: "disablePicoLed", fieldId: 0x08, encode: (config) => boolByte(config.disablePicoLed) },
  { key: "pollingRateMode", fieldId: 0x09, encode: (config) => byte(config.pollingRateMode) },
  { key: "audioBufferLength", fieldId: 0x0a, encode: (config) => byte(config.audioBufferLength) },
  { key: "controllerMode", fieldId: 0x0b, encode: (config) => byte(config.controllerMode) },
  { key: "lockVolume", fieldId: 0x0c, encode: (config) => boolByte(config.lockVolume) },
  { key: "disableUsbSn", fieldId: 0x0d, encode: (config) => boolByte(config.disableUsbSn) },
  { key: "psShortcutEnabled", fieldId: 0x0e, encode: (config) => boolByte(config.psShortcutEnabled) },
  { key: "disableMic", fieldId: 0x0f, encode: (config) => boolByte(config.disableMic) },
  { key: "disableSpeaker", fieldId: 0x10, encode: (config) => boolByte(config.disableSpeaker) },
  { key: "enableWake", fieldId: 0x11, encode: (config) => boolByte(config.enableWake) },
];

function commandReport(command: number, payload?: Uint8Array): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
  report[0] = COMMAND_PREFIX;
  report[1] = command;

  if (payload) {
    if (payload.byteLength > FEATURE_REPORT_PAYLOAD_SIZE - 2) {
      throw new Error(`Command 0x${command.toString(16)} payload is too large`);
    }

    report.set(payload, 2);
  }

  return report;
}

function decodeFirmwareVersion(source: ArrayBuffer | DataView | Uint8Array): string {
  const bytes = trimTrailingZeros(toUint8Array(source));

  const version = decodePrintableString(bytes);
  if (version) {
    return version;
  }

  return bytes.length > 0 ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ") : "";
}

function decodePrintableString(bytes: Uint8Array): string {
  const text = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  return /^[\x20-\x7e]+$/.test(text) ? text : "";
}

function decodeSignalStatus(source: ArrayBuffer | DataView | Uint8Array): SignalStatus {
  const bytes = toUint8Array(source);
  const rssi = bytes.length > 0 ? decodeRssiByte(bytes[0]) : null;
  const flags = bytes.length > 1 ? bytes[1] : null;
  const hasAudioFlags = flags !== null && (flags & 0x80) === 0x80;

  return {
    rssi,
    micActive: hasAudioFlags ? (flags & 0x01) === 0x01 : null,
    speakerActive: hasAudioFlags ? (flags & 0x02) === 0x02 : null,
  };
}

function decodeRssiByte(byte: number): number | null {
  const value = toInt8(byte);
  return value >= -128 && value <= 0 ? value : null;
}

function commandResponsePayload(source: ArrayBuffer | DataView | Uint8Array, command: number): Uint8Array {
  const bytes = toUint8Array(source);
  const starts = bytes[0] === REPORT_RESPONSE ? [1, 0] : [0, 1];

  for (const start of starts) {
    if (start >= bytes.length) {
      continue;
    }

    if (bytes[start] === COMMAND_PREFIX && bytes[start + 1] === command) {
      return bytes.slice(start + 2);
    }

    if (bytes[start] === command) {
      return bytes.slice(start + 1);
    }
  }

  const sample = Array.from(bytes.slice(0, 8), (byteValue) => byteValue.toString(16).padStart(2, "0")).join(" ");
  throw new Error(`Unexpected response for command 0x${command.toString(16).padStart(2, "0")}: ${sample}`);
}

function changedConfigFields(config: ConfigBody, previousConfig: ConfigBody | null): ConfigFieldSpec[] {
  if (!previousConfig) {
    return CONFIG_FIELD_SPECS;
  }

  return CONFIG_FIELD_SPECS.filter((field) => {
    if (field.equals) {
      return !field.equals(previousConfig, config);
    }

    return previousConfig[field.key] !== config[field.key];
  });
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
