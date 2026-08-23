// iso.js - read files out of an ISO 9660 disc image without mounting it.
//
// Written for the Mazda EPC discs (extract_mazda_epc.js), which arrive as five
// ISO images. Mounting five images to find out what is on them is slower than
// reading the filesystem, and mounting needs privileges this does not.
//
// ISO 9660, all fields little-endian where a choice exists:
//
//   Sectors are 2048 bytes. The Primary Volume Descriptor sits at sector 16
//   and is identified by "CD001" at offset 1. Its offset 156 holds the root
//   directory record.
//
//   A directory record is length-prefixed at +0, with the extent LBA at +2 and
//   the data length at +10 - both stored little-endian then big-endian, so the
//   first copy is the one to read - the flags byte at +25 (bit 1 set means
//   directory), and a length-prefixed name at +32.
//
//   Records never straddle a sector boundary. A zero length byte means "no
//   more records in this sector", NOT end of directory, so the walk skips to
//   the next sector rather than stopping. Stopping there truncates any
//   directory bigger than one sector, which on these discs is most of them.
'use strict';
const fs = require('fs');

const SECTOR = 2048;

function readDir(fd, lba, size, depth, out, prefix, maxDepth) {
  if (depth > maxDepth) return;
  const buf = Buffer.alloc(size);
  fs.readSync(fd, buf, 0, size, lba * SECTOR);
  let p = 0;
  while (p < size) {
    const len = buf[p];
    if (len === 0) {
      p = (Math.floor(p / SECTOR) + 1) * SECTOR;
      if (p >= size) break;
      continue;
    }
    const extent = buf.readUInt32LE(p + 2);
    const dataLen = buf.readUInt32LE(p + 10);
    const flags = buf[p + 25];
    const nameLen = buf[p + 32];
    let name = buf.subarray(p + 33, p + 33 + nameLen).toString('latin1');
    p += len;
    // "." and ".." are stored as single bytes 0x00 and 0x01.
    if (nameLen === 1 && (name.charCodeAt(0) === 0 || name.charCodeAt(0) === 1)) continue;
    name = name.replace(/;\d+$/, '');          // strip the ISO version suffix
    const full = prefix + '/' + name;
    if (flags & 2) {
      out.dirs.push(full);
      readDir(fd, extent, dataLen, depth + 1, out, full, maxDepth);
    } else {
      out.files.push({ path: full, size: dataLen, lba: extent });
    }
  }
}

/** List every directory and file in an ISO image. */
function listIso(file, opts = {}) {
  const fd = fs.openSync(file, 'r');
  try {
    const pvd = Buffer.alloc(SECTOR);
    fs.readSync(fd, pvd, 0, SECTOR, 16 * SECTOR);
    if (pvd.subarray(1, 6).toString('latin1') !== 'CD001')
      throw new Error(file + ': not an ISO 9660 image (no CD001 at sector 16)');
    const volId = pvd.subarray(40, 72).toString('latin1').trim();
    const root = pvd.subarray(156, 156 + 34);
    const out = { volId, dirs: [], files: [] };
    readDir(fd, root.readUInt32LE(2), root.readUInt32LE(10), 0, out, '',
            opts.maxDepth || 8);
    return out;
  } finally { fs.closeSync(fd); }
}

/** Read one file's bytes, given the entry listIso returned for it. */
function readFile(isoPath, entry) {
  const fd = fs.openSync(isoPath, 'r');
  try {
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, entry.lba * SECTOR);
    return buf;
  } finally { fs.closeSync(fd); }
}

module.exports = { listIso, readFile, SECTOR };

if (require.main === module) {
  const r = listIso(process.argv[2]);
  const total = r.files.reduce((s, f) => s + f.size, 0);
  console.log('volume ' + JSON.stringify(r.volId) + ': ' + r.dirs.length + ' dirs, ' +
              r.files.length + ' files, ' + (total / 1024 / 1024).toFixed(1) + ' MB');
  for (const f of r.files.sort((a, b) => b.size - a.size).slice(0, 20))
    console.log('  ' + String((f.size / 1024 / 1024).toFixed(2)).padStart(8) + ' MB  ' + f.path);
}
