const fs = require('fs').promises;

// Read the first `n` bytes of a file without loading the whole thing.
async function readBytes(filePath, n) {
  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fh.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

function startsWith(buf, bytes) {
  return bytes.every((b, i) => buf[i] === b);
}

// Returns true only when the file on disk is a real PDF.
async function isPdf(filePath) {
  const buf = await readBytes(filePath, 4);
  // %PDF
  return startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
}

// Returns true only when the file on disk is a real PPT or PPTX.
// PPTX, DOCX, and XLSX all share the same ZIP magic bytes, so we must look
// inside the archive at the stored entry names to tell them apart.
async function isPowerPoint(filePath) {
  const buf = await readBytes(filePath, 8192); // 8 KB covers the ZIP local headers

  // OLE2 compound document (legacy .ppt / .doc / .xls all share this header)
  const isOle2 = startsWith(buf, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  if (isOle2) {
    // OLE2 directory entries store stream names as UTF-16LE.
    // .ppt has "PowerPoint Document"; .doc has "WordDocument"; .xls has "Workbook".
    const pptMarker = Buffer.from('PowerPoint Document', 'utf16le');
    return buf.includes(pptMarker);
  }

  // ZIP / OOXML (.pptx / .docx / .xlsx)
  const isZip = startsWith(buf, [0x50, 0x4B, 0x03, 0x04]);
  if (isZip) {
    // ZIP local-file headers store entry names as plain ASCII/UTF-8.
    // PPTX always contains a "ppt/" directory; DOCX has "word/"; XLSX has "xl/".
    const text = buf.toString('ascii');
    return text.includes('ppt/');
  }

  return false;
}

// Returns true only when the file on disk is a real video.
async function isVideo(filePath) {
  const buf = await readBytes(filePath, 12);

  // MP4 / MOV / M4V — "ftyp" box at byte 4
  const isMp4Family = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
  // QuickTime "moov" or "mdat" or "free" at byte 4
  const isQuickTime = (buf[4] === 0x6D && buf[5] === 0x6F && buf[6] === 0x6F && buf[7] === 0x76) ||
                      (buf[4] === 0x6D && buf[5] === 0x64 && buf[6] === 0x61 && buf[7] === 0x74) ||
                      (buf[4] === 0x66 && buf[5] === 0x72 && buf[6] === 0x65 && buf[7] === 0x65);
  // WebM / MKV — EBML header
  const isWebM = startsWith(buf, [0x1A, 0x45, 0xDF, 0xA3]);
  // AVI — RIFF....AVI
  const isAvi = startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
                buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20;
  // WMV / ASF
  const isWmv = startsWith(buf, [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11]);
  // FLV
  const isFlv = startsWith(buf, [0x46, 0x4C, 0x56, 0x01]);
  // 3GP (MP4 family with "3gp" in ftyp, handled by isMp4Family)

  return isMp4Family || isQuickTime || isWebM || isAvi || isWmv || isFlv;
}

module.exports = { isPdf, isPowerPoint, isVideo };
