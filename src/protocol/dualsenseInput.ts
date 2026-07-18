export const DUALSENSE_INPUT_REPORT_ID = 0x01;

export interface DualSenseStickInput {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
}

export function decodeDualSenseStickInput(
  reportId: number,
  source: ArrayBuffer | DataView | Uint8Array,
): DualSenseStickInput | null {
  if (reportId !== DUALSENSE_INPUT_REPORT_ID) return null;
  const bytes = toUint8Array(source);
  const offset = bytes.byteLength >= 64 && bytes[0] === reportId ? 1 : 0;
  if (bytes.byteLength - offset < 4) return null;
  return {
    leftX: bytes[offset],
    leftY: bytes[offset + 1],
    rightX: bytes[offset + 2],
    rightY: bytes[offset + 3],
  };
}

function toUint8Array(source: ArrayBuffer | DataView | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) return source;
  if (source instanceof DataView) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return new Uint8Array(source);
}
