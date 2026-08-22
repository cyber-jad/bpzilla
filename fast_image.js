// fast_image.js — read the Nissan FAST image containers.
//
// The FAST discs store their diagrams as raw CCITT Group 4 (ITU-T T.6) fax
// streams with no wrapper, so nothing off the shelf opens them. This is a
// minimal G4 decoder plus a PNG writer; no dependencies beyond node's zlib.
//
// Container format (worked out against H:\AR-JP\JP\079, the R32 volume):
//
//   <SECTION>NOTE.NNN   index, 54-byte fixed records
//     [0-1]   record marker (0x004F)
//     [2-7]   code, ASCII, e.g. "JC  01" / "JD  06"
//     [8-47]  title, 40 bytes Shift-JIS, e.g. モデル記号の意味（オプション記号）
//     [48-50] offset into the image file, in 256-byte blocks
//     [51]    type flag (1)
//     [52-53] byte length of the image
//
//   <SECTION>IMG.NNN    the G4 streams, at those offsets
//
// Pages are 1280px wide. Height is not stored: decode until the stream is
// exhausted, which lands on ~642 rows for the R32 front matter. A wrong width
// desynchronises the decoder immediately, so sweeping candidate widths and
// picking the one with fewest errors recovers it for other volumes.
//
// Usage:
//   const { decodeG4, writePNG } = require('./fast_image.js');
//   const { rows, errors } = decodeG4(streamBuffer, 1280, 5000);
//   writePNG(rows, 1280, 'page.png');
//
// What this unlocks: MAENOTE/MAEIMG hold the 収録車両案内 front matter, which
// is where Nissan documents the model code itself — see the _r32Legend tables
// in public/js/database.js. SECIMG holds the parts-section illustrations and
// uses the same encoding.
'use strict';
const zlib = require('zlib');

// ---- MH run-length code tables (T.4) -------------------------------------
const WHITE = {
  '00110101':0,'000111':1,'0111':2,'1000':3,'1011':4,'1100':5,'1110':6,'1111':7,
  '10011':8,'10100':9,'00111':10,'01000':11,'001000':12,'000011':13,'110100':14,
  '110101':15,'101010':16,'101011':17,'0100111':18,'0001100':19,'0001000':20,
  '0010111':21,'0000011':22,'0000100':23,'0101000':24,'0101011':25,'0010011':26,
  '0100100':27,'0011000':28,'00000010':29,'00000011':30,'00011010':31,'00011011':32,
  '00010010':33,'00010011':34,'00010100':35,'00010101':36,'00010110':37,'00010111':38,
  '00101000':39,'00101001':40,'00101010':41,'00101011':42,'00101100':43,'00101101':44,
  '00000100':45,'00000101':46,'00001010':47,'00001011':48,'01010010':49,'01010011':50,
  '01010100':51,'01010101':52,'00100100':53,'00100101':54,'01011000':55,'01011001':56,
  '01011010':57,'01011011':58,'01001010':59,'01001011':60,'00110010':61,'00110011':62,
  '00110100':63,
  '11011':64,'10010':128,'010111':192,'0110111':256,'00110110':320,'00110111':384,
  '01100100':448,'01100101':512,'01101000':576,'01100111':640,'011001100':704,
  '011001101':768,'011010010':832,'011010011':896,'011010100':960,'011010101':1024,
  '011010110':1088,'011010111':1152,'011011000':1216,'011011001':1280,'011011010':1344,
  '011011011':1408,'010011000':1472,'010011001':1536,'010011010':1600,'011000':1664,
  '010011011':1728
};
const BLACK = {
  '0000110111':0,'010':1,'11':2,'10':3,'011':4,'0011':5,'0010':6,'00011':7,
  '000101':8,'000100':9,'0000100':10,'0000101':11,'0000111':12,'00000100':13,
  '00000111':14,'000011000':15,'0000010111':16,'0000011000':17,'0000001000':18,
  '00001100111':19,'00001101000':20,'00001101100':21,'00000110111':22,'00000101000':23,
  '00000010111':24,'00000011000':25,'000011001010':26,'000011001011':27,'000011001100':28,
  '000011001101':29,'000001101000':30,'000001101001':31,'000001101010':32,'000001101011':33,
  '000011010010':34,'000011010011':35,'000011010100':36,'000011010101':37,'000011010110':38,
  '000011010111':39,'000001101100':40,'000001101101':41,'000011011010':42,'000011011011':43,
  '000001010100':44,'000001010101':45,'000001010110':46,'000001010111':47,'000001100100':48,
  '000001100101':49,'000001010010':50,'000001010011':51,'000000100100':52,'000000110111':53,
  '000000111000':54,'000000100111':55,'000000101000':56,'000001011000':57,'000001011001':58,
  '000000101011':59,'000000101100':60,'000001011010':61,'000001100110':62,'000001100111':63,
  '0000001111':64,'000011001000':128,'000011001001':192,'000001011011':256,
  '000000110011':320,'000000110100':384,'000000110101':448,'0000001101100':512,
  '0000001101101':576,'0000001001010':640,'0000001001011':704,'0000001001100':768,
  '0000001001101':832,'0000001110010':896,'0000001110011':960,'0000001110100':1024,
  '0000001110101':1088,'0000001110110':1152,'0000001110111':1216,'0000001010010':1280,
  '0000001010011':1344,'0000001010100':1408,'0000001010101':1472,'0000001011010':1536,
  '0000001011011':1600,'0000001100100':1664,'0000001100101':1728
};
const EXT = {
  '00000001000':1792,'00000001100':1856,'00000001101':1920,'000000010010':1984,
  '000000010011':2048,'000000010100':2112,'000000010101':2176,'000000010110':2240,
  '000000010111':2304,'000000011100':2368,'000000011101':2432,'000000011110':2496,
  '000000011111':2560
};
for (const k in EXT) { WHITE[k] = EXT[k]; BLACK[k] = EXT[k]; }

class Bits {
  constructor(buf) { this.b = buf; this.p = 0; }
  get bitsLeft() { return this.b.length * 8 - this.p; }
  peekBit(i) { const p = this.p + i; return (this.b[p >> 3] >> (7 - (p & 7))) & 1; }
  read() { const v = this.peekBit(0); this.p++; return v; }
}

function readRun(bits, white) {
  const table = white ? WHITE : BLACK;
  let total = 0;
  for (;;) {
    let s = '', got = null;
    for (let n = 0; n < 14; n++) {
      if (bits.bitsLeft <= 0) return null;
      s += bits.read();
      if (table[s] !== undefined) { got = table[s]; break; }
    }
    if (got === null) return null;
    total += got;
    if (got < 64) return total;      // terminating code ends the run
  }
}

function decodeG4(buf, width, maxRows) {
  const bits = new Bits(buf);
  let ref = [width, width];          // changing elements on the reference line
  const rows = [];
  let errors = 0;
  while (rows.length < maxRows && bits.bitsLeft > 8) {
    const cur = [];
    let a0 = -1, color = 0;          // 0 = white
    let guard = 0;
    while (a0 < width) {
      if (++guard > width * 4) { errors++; break; }
      // b1 = first changing element on ref line right of a0 with opposite colour of a0's colour run
      let i = 0;
      while (i < ref.length && ref[i] <= (a0 < 0 ? -1 : a0)) i++;
      if ((i & 1) !== (color & 1)) i++;
      const b1 = i < ref.length ? ref[i] : width;
      const b2 = (i + 1) < ref.length ? ref[i + 1] : width;

      // read a mode code
      let s = '', mode = null;
      for (let n = 0; n < 7; n++) {
        if (bits.bitsLeft <= 0) { mode = 'EOD'; break; }
        s += bits.read();
        if (s === '1') { mode = 'V0'; break; }
        if (s === '011') { mode = 'VR1'; break; }
        if (s === '010') { mode = 'VL1'; break; }
        if (s === '001') { mode = 'H'; break; }
        if (s === '0001') { mode = 'P'; break; }
        if (s === '000011') { mode = 'VR2'; break; }
        if (s === '000010') { mode = 'VL2'; break; }
        if (s === '0000011') { mode = 'VR3'; break; }
        if (s === '0000010') { mode = 'VL3'; break; }
      }
      if (mode === null || mode === 'EOD') { errors++; a0 = width; break; }

      if (mode === 'P') { a0 = b2; continue; }
      if (mode === 'H') {
        const start = a0 < 0 ? 0 : a0;
        const r1 = readRun(bits, color === 0);
        const r2 = readRun(bits, color !== 0);
        if (r1 === null || r2 === null) { errors++; a0 = width; break; }
        const a1 = Math.min(start + r1, width);
        const a2 = Math.min(a1 + r2, width);
        cur.push(a1, a2);
        a0 = a2;
        continue;
      }
      const d = { V0:0, VR1:1, VR2:2, VR3:3, VL1:-1, VL2:-2, VL3:-3 }[mode];
      const a1 = Math.max(0, Math.min(b1 + d, width));
      cur.push(a1);
      a0 = a1;
      color ^= 1;
    }
    // materialise the row from its changing elements
    const row = Buffer.alloc(width, 255);   // white
    let c = 0, pos = 0;
    for (const x of cur) {
      if (c === 1) row.fill(0, pos, Math.min(x, width));
      pos = Math.min(x, width); c ^= 1;
    }
    if (c === 1 && pos < width) row.fill(0, pos, width);
    rows.push(row);
    ref = cur.length ? cur.slice() : [width, width];
    ref.push(width, width);
  }
  return { rows, errors };
}

function writePNG(rows, width, file) {
  const h = rows.length;
  const raw = Buffer.alloc((width + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (width + 1)] = 0; rows[y].copy(raw, y * (width + 1) + 1); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    chunks.push(len, td, crc);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunk('IHDR', ihdr); chunk('IDAT', idat); chunk('IEND', Buffer.alloc(0));
  require('fs').writeFileSync(file, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ...chunks]));
}
let CRCT = null;
function crc32(buf) {
  if (!CRCT) { CRCT = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRCT[n] = c; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF);
}
module.exports = { decodeG4, writePNG };
