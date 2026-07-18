import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("project metadata contains no retired scaffold dependencies", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.match(packageJson.version ?? "", /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.dependencies?.sharp, undefined);
  assert.equal(packageJson.devDependencies?.sharp, undefined);
});

test("runtime public assets remain relative for project Pages hosting", () => {
  const appHeader = read("src/components/AppHeader.tsx");

  assert.doesNotMatch(appHeader, /src=["']\/pwa-/);
  assert.match(appHeader, /src=["']\.\/pwa-icon\.svg["']/);
});

test("README files do not reference retired planning documents", () => {
  for (const path of ["README.md", "README.zh-CN.md"]) {
    assert.doesNotMatch(read(path), /docs\/M61_(?:WEB_REFACTOR_SPEC|FEATURE_GAP_MATRIX)/);
  }
});
