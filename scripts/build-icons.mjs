// Copies node/credential icons (svg/png) into dist, preserving directory layout.
// n8n loads an icon referenced as `file:<name>.svg` from next to the compiled
// node .js, so the icon must be copied alongside the tsc output.
import { cp, readdir } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ICON_EXT = new Set([".svg", ".png"]);
const SOURCE_DIRS = ["nodes", "credentials"];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory does not exist — nothing to copy
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (ICON_EXT.has(extname(entry.name))) yield full;
  }
}

let copied = 0;
for (const base of SOURCE_DIRS) {
  for await (const src of walk(join(root, base))) {
    const dest = join(root, "dist", relative(root, src));
    await cp(src, dest);
    copied++;
  }
}
console.log(`build-icons: copied ${copied} icon(s) to dist/`);
