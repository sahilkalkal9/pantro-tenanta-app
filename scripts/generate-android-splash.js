import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tenantDir = path.resolve(__dirname, '..');

// Standard CRC32
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}
const crcTable = makeCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data ? data.length : 0;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  if (data) data.copy(chunk, 8);
  const toCrc = Buffer.concat([typeBuf, data || Buffer.alloc(0)]);
  chunk.writeUInt32BE(crc32(toCrc), 8 + len);
  return chunk;
}

function encodePng(w, h, rgbaBuf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // Filter: None
    rgbaBuf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = makeChunk('IEND', null);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// 1. Read source splash.png
const srcPath = path.join(tenantDir, 'assets', 'splash.png');
const srcBuf = fs.readFileSync(srcPath);
const srcW = srcBuf.readUInt32BE(16);
const srcH = srcBuf.readUInt32BE(20);
let pos = 8;
const idatChunks = [];
while (pos < srcBuf.length) {
  const len = srcBuf.readUInt32BE(pos);
  const type = srcBuf.toString('ascii', pos + 4, pos + 8);
  if (type === 'IDAT') idatChunks.push(srcBuf.subarray(pos + 8, pos + 8 + len));
  pos += 12 + len;
}
const srcDec = zlib.inflateSync(Buffer.concat(idatChunks));
const srcRowLen = srcW * 4 + 1;

function getSrcPixel(x, y) {
  if (x < 0 || x >= srcW || y < 0 || y >= srcH) return [7, 11, 20, 255];
  const o = y * srcRowLen + 1 + x * 4;
  return [srcDec[o], srcDec[o+1], srcDec[o+2], srcDec[o+3]];
}

// High quality Bilinear interpolation
function sampleBilinear(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, srcW - 1);
  const y1 = Math.min(y0 + 1, srcH - 1);
  const fx = x - x0;
  const fy = y - y0;

  const c00 = getSrcPixel(x0, y0);
  const c10 = getSrcPixel(x1, y0);
  const c01 = getSrcPixel(x0, y1);
  const c11 = getSrcPixel(x1, y1);

  const out = [];
  for (let i = 0; i < 4; i++) {
    const top = c00[i] * (1 - fx) + c10[i] * fx;
    const bot = c01[i] * (1 - fx) + c11[i] * fx;
    out[i] = Math.round(top * (1 - fy) + bot * fy);
  }
  return out;
}

// Generate splash for any target dimension S x S
function generateSplash(S) {
  const dst = Buffer.alloc(S * S * 4);
  const srcCenterX = 643;
  const srcCenterY = 1255.5;

  // Content height in source is 512 px.
  // In target canvas S, we scale it to exactly 0.50 * S so it sits cleanly inside safe zone.
  const targetH = S * 0.50;
  const scale = targetH / 512;

  const dstCenterX = S / 2;
  const dstCenterY = S / 2;

  for (let dy = 0; dy < S; dy++) {
    for (let dx = 0; dx < S; dx++) {
      const srcX = (dx - dstCenterX) / scale + srcCenterX;
      const srcY = (dy - dstCenterY) / scale + srcCenterY;
      const [r, g, b, a] = sampleBilinear(srcX, srcY);
      const o = (dy * S + dx) * 4;
      dst[o] = r;
      dst[o+1] = g;
      dst[o+2] = b;
      dst[o+3] = a;
    }
  }

  return encodePng(S, S, dst);
}

// Generate target files
const targets = [
  { size: 1152, dest: path.join(tenantDir, 'assets', 'splash-android.png') },
  { size: 288, dest: path.join(tenantDir, 'android', 'app', 'src', 'main', 'res', 'drawable-mdpi', 'splashscreen_logo.png') },
  { size: 432, dest: path.join(tenantDir, 'android', 'app', 'src', 'main', 'res', 'drawable-hdpi', 'splashscreen_logo.png') },
  { size: 576, dest: path.join(tenantDir, 'android', 'app', 'src', 'main', 'res', 'drawable-xhdpi', 'splashscreen_logo.png') },
  { size: 864, dest: path.join(tenantDir, 'android', 'app', 'src', 'main', 'res', 'drawable-xxhdpi', 'splashscreen_logo.png') },
  { size: 1152, dest: path.join(tenantDir, 'android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi', 'splashscreen_logo.png') },
];

console.log('Generating pixel-perfect Android splash screens...');
for (const t of targets) {
  const dir = path.dirname(t.dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const png = generateSplash(t.size);
  fs.writeFileSync(t.dest, png);
  console.log(`✓ ${path.relative(tenantDir, t.dest)} (${t.size}x${t.size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log('\nAll Android splash screen assets generated successfully!');
