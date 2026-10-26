import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..");
const fb = __dirname;
const buildRoot = path.join(fb, "_build");
const manifestPath = path.join(fb, "manifest.json");

const ESP_OFFSETS = {
  bootloader: "0x0",
  partitions: "0x8000",
  bootApp0: "0xe000",
  app: "0x10000",
};

function buildDefinesArgs(defines) {
  if (!defines || typeof defines !== "object") return [];
  const flags = Object.entries(defines).map(([k, v]) => `-D${k}=${v}`);
  if (!flags.length) return [];
  const joined = flags.join(" ");
  return [
    "--build-property",
    `compiler.c.extra_flags=${joined}`,
    "--build-property",
    `compiler.cpp.extra_flags=${joined}`,
    "--build-property",
    `compiler.S.extra_flags=${joined}`,
  ];
}

function inoStem(sketchRel) {
  return path.basename(sketchRel);
}

function compilePreset(preset) {
  const sketchRel = preset.sketch || "examples/LucarnePreview";
  const sketchPath = path.join(repo, sketchRel);
  const stem = inoStem(sketchRel);
  const outName = preset.id;
  const outDir = path.join(buildRoot, outName);
  fs.mkdirSync(outDir, { recursive: true });

  const args = [
    "compile",
    "--library",
    repo,
    "-b",
    preset.buildFqbn,
    "--output-dir",
    outDir,
    "--export-binaries",
    ...(process.argv.indexOf("--clean") >= 0 ? ["--clean"] : []),
    ...buildDefinesArgs(preset.buildDefines),
    sketchPath,
  ];

  console.log(`\n=== ${preset.id} (${preset.buildFqbn}) ===`);
  const r = spawnSync("arduino-cli", args, { stdio: "inherit", cwd: repo, shell: false });
  if (r.status !== 0) {
    console.error(`FAILED: ${preset.id}`);
    return false;
  }

  const base = path.join(outDir, `${stem}.ino`);
  const dest = path.join(fb, outName);
  fs.mkdirSync(dest, { recursive: true });

  const copy = (srcSuffix, destName) => {
    const src = `${base}${srcSuffix}`;
    if (!fs.existsSync(src)) return false;
    fs.copyFileSync(src, path.join(dest, destName));
    return true;
  };

  const hasBoot = copy(".bootloader.bin", "bootloader.bin");
  const hasPart = copy(".partitions.bin", "partitions.bin");
  const hasApp = copy(".bin", "app.bin");
  if (!hasApp) {
    console.error(`Missing app bin for ${preset.id}`);
    return false;
  }
  if (!hasBoot || !hasPart) {
    console.error(`Missing bootloader/partitions for ${preset.id} (not ESP32 export?)`);
    return false;
  }
  console.log(`OK: ${preset.id} -> ${dest}`);
  return true;
}

function applyPrebuilt(manifest, presetId, on) {
  const p = manifest.presets.find((x) => x.id === presetId);
  if (!p) return;
  if (!on) {
    p.prebuilt = false;
    delete p.offsets;
    delete p.files;
    return;
  }
  p.prebuilt = true;
  p.offsets = { ...ESP_OFFSETS };
  p.files = {
    bootloader: `${presetId}/bootloader.bin`,
    partitions: `${presetId}/partitions.bin`,
    app: `${presetId}/app.bin`,
  };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const only = process.argv.slice(2);
const presets = manifest.presets.filter(
  (p) =>
    p.buildFqbn &&
    /^esp32/.test(p.chip || "") &&
    p.displayKind !== "mipi_dsi" &&
    (only.length === 0 || only.indexOf(p.id) >= 0)
);

const results = [];
for (const preset of presets) {
  const ok = compilePreset(preset);
  results.push({ id: preset.id, ok });
  if (ok) applyPrebuilt(manifest, preset.id, true);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log("\n--- Summary ---");
for (const { id, ok } of results) {
  console.log(`${ok ? "OK" : "FAIL"}  ${id}`);
}
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
