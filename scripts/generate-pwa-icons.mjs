/**
 * Writes public/icon-192.png and public/icon-512.png (brand orange #FF6B35).
 * Matches favicon.svg tile color; run `npm run generate:pwa-icons` after clone.
 */
import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const R = 0xff;
const G = 0x6b;
const B = 0x35;
const A = 0xff;

function writeSolidPng(size, filename) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = R;
      png.data[idx + 1] = G;
      png.data[idx + 2] = B;
      png.data[idx + 3] = A;
    }
  }
  fs.writeFileSync(join(root, "public", filename), PNG.sync.write(png));
}

writeSolidPng(192, "icon-192.png");
writeSolidPng(512, "icon-512.png");
console.log("Wrote public/icon-192.png and public/icon-512.png");
