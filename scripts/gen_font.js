const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "core", "LucarneClassicFont.cpp");
const out = path.join(__dirname, "..", "editor", "lucarne-font.js");

const text = fs.readFileSync(src, "utf8");
const anchor = text.indexOf("LucarneClassicFont");
const start = text.indexOf("{", anchor);
const end = text.indexOf("}", start);
const body = text.slice(start + 1, end);

const bytes = body
  .split(",")
  .map((s) => s.trim())
  .filter((s) => /^0x[0-9a-fA-F]+$/.test(s))
  .map((s) => parseInt(s, 16));

if (bytes.length !== 1280) {
  console.error("Unexpected font length: " + bytes.length + " (expected 1280)");
  process.exit(1);
}

let js = "// Generated from src/core/LucarneClassicFont.cpp - do not edit by hand\n";
js += "window.LUCARNE_FONT5x7 = new Uint8Array([\n";
for (let i = 0; i < bytes.length; i += 16) {
  js += "  " + bytes.slice(i, i + 16).join(", ") + ",\n";
}
js += "]);\n";

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, js);
console.log("Wrote " + out + " (" + bytes.length + " bytes)");
