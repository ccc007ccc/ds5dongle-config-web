import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const roots = ["src", "public", "docs"];
const files = ["README.md", "README.zh-CN.md", "index.html", "vite.config.ts", "package.json"];
const extensions = new Set([".ts", ".tsx", ".css", ".md", ".csv", ".html", ".json", ".svg"]);
const forbidden = [
  /pico2w/i,
  /raspberry\s+pi/i,
  /树莓派/,
  /disablePicoLed/,
  /pollingRateMode/,
  /audioBufferLength/,
  /enableUsbSn/,
  /psShortcutEnabled/,
];

for (const root of roots) collect(root);
const failures = [];
for (const file of files) check(file);

if (failures.length > 0) {
  console.error("M61 product-boundary check failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("M61 product-boundary check passed.");

function collect(path) {
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) collect(child);
    else if (extensions.has(extname(child))) files.push(child);
  }
}

function check(file) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) failures.push(`${relative(".", file)}: ${pattern}`);
  }
}
