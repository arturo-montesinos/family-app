// Generates PWA / Apple icons into public/ from one SVG. Run: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const mark = (pad = 0) => {
  // `pad` shrinks the artwork inside the canvas (maskable icons need a safe zone).
  const s = 64 - pad * 2;
  const k = s / 64;
  const g = (v) => pad + v * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${pad ? 0 : 14}" fill="#2b6a5d"/>
  <rect x="${g(12)}" y="${g(16)}" width="${40 * k}" height="${36 * k}" rx="${7 * k}" fill="#f7fbf9"/>
  <rect x="${g(12)}" y="${g(16)}" width="${40 * k}" height="${10 * k}" rx="${5 * k}" fill="#f4b740"/>
  <circle cx="${g(23)}" cy="${g(38)}" r="${4.5 * k}" fill="#d9485f"/>
  <circle cx="${g(35)}" cy="${g(38)}" r="${4.5 * k}" fill="#3f7cc4"/>
  <rect x="${g(40)}" y="${g(34)}" width="${6 * k}" height="${8 * k}" rx="${3 * k}" fill="#4f9d3a"/>
</svg>`;
};

const out = new URL("../public/", import.meta.url);
await writeFile(new URL("icon.svg", out), mark());
const png = (svg, size, file, flatten) =>
  sharp(Buffer.from(svg), { density: 600 })
    .resize(size, size)
    .flatten(flatten ? { background: "#2b6a5d" } : false)
    .png()
    .toFile(new URL(file, out).pathname);

await png(mark(), 192, "icon-192.png");
await png(mark(), 512, "icon-512.png");
await png(mark(8), 512, "icon-maskable-512.png", true);
// Apple applies its own rounded mask; give it a full-bleed square.
await png(mark(4), 180, "apple-touch-icon.png", true);
console.log("icons written to public/");
