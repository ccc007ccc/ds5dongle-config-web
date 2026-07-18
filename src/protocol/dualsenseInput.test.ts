import assert from "node:assert/strict";
import test from "node:test";
import { decodeDualSenseStickInput } from "./dualsenseInput.ts";

test("decodes WebHID input data without a report-ID prefix", () => {
  const payload = new Uint8Array(63);
  payload.set([1, 127, 200, 255]);
  assert.deepEqual(decodeDualSenseStickInput(0x01, payload), {
    leftX: 1,
    leftY: 127,
    rightX: 200,
    rightY: 255,
  });
});

test("accepts compatibility data that includes the report ID", () => {
  const report = new Uint8Array(64);
  report.set([0x01, 10, 20, 30, 40]);
  assert.deepEqual(decodeDualSenseStickInput(0x01, report), {
    leftX: 10,
    leftY: 20,
    rightX: 30,
    rightY: 40,
  });
});

test("ignores unrelated or truncated reports", () => {
  assert.equal(decodeDualSenseStickInput(0x31, new Uint8Array(64)), null);
  assert.equal(decodeDualSenseStickInput(0x01, new Uint8Array(3)), null);
});
