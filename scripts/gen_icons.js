const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "ui", "LucarneIcons.cpp");
const out = path.join(__dirname, "..", "editor", "lucarne-icons.js");

const text = fs.readFileSync(src, "utf8");

const arrays = {};
const arrRe = /static const uint16_t (ICON_[A-Z_]+)\[16\]\s*=\s*\{([\s\S]*?)\};/g;
let m;
while ((m = arrRe.exec(text)) !== null) {
  const ident = m[1];
  const rows = m[2]
    .match(/0b[01]+/g)
    .map((b) => parseInt(b.slice(2), 2));
  if (rows.length !== 16) {
    console.error("Icon " + ident + " has " + rows.length + " rows");
    process.exit(1);
  }
  arrays[ident] = rows;
}

const table = {};
const tableRe = /\{\s*"([a-z_]+)"\s*,\s*(ICON_[A-Z_]+|nullptr)\s*\}/g;
while ((m = tableRe.exec(text)) !== null) {
  if (m[2] !== "nullptr") {
    table[m[1]] = arrays[m[2]];
  }
}

let js = "// Generated from src/ui/LucarneIcons.cpp - do not edit by hand\n";
js += "window.LUCARNE_ICONS = {\n";
for (const name of Object.keys(table)) {
  js += "  " + name + ": [" + table[name].join(", ") + "],\n";
}
js += "};\n";

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, js);
console.log("Wrote " + out + " (" + Object.keys(table).length + " icons)");
