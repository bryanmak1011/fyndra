import { inflateRawSync } from 'node:zlib';

// A minimal ZIP-container reader scoped to exactly one job: pull a named
// entry (e.g. "word/document.xml") out of a .docx. DOCX/XLSX/PPTX are all
// ordinary ZIP archives under the hood.
//
// ponytail: no dependency (adm-zip/jszip) for what turns out to be ~60
// lines against the End-Of-Central-Directory record. Deliberately narrow:
// only STORED (0) and DEFLATE (8) compression, no Zip64, no encryption —
// exactly what Word/Pages/LibreOffice write for a document.xml part. Any
// archive outside that throws, loudly, rather than silently returning
// wrong bytes; extract.ts turns that into `unsupported_format`.
export class UnsupportedZipError extends Error {}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buf: Buffer): number {
  // The EOCD record is within the last 64KB (its comment field is at most
  // 65535 bytes) — scan backwards for the signature rather than assuming
  // a fixed offset.
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new UnsupportedZipError('No End Of Central Directory record found — not a ZIP file');
}

export function readZipEntry(buf: Buffer, entryName: string): Buffer {
  const eocdOffset = findEndOfCentralDirectory(buf);
  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) {
      throw new UnsupportedZipError('Malformed central directory entry');
    }
    const compressionMethod = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (name === entryName) {
      return extractLocalFile(buf, localHeaderOffset, compressionMethod, compressedSize);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new UnsupportedZipError(`Entry not found in archive: ${entryName}`);
}

function extractLocalFile(
  buf: Buffer,
  localHeaderOffset: number,
  compressionMethod: number,
  compressedSize: number,
): Buffer {
  if (buf.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    throw new UnsupportedZipError('Malformed local file header');
  }
  const nameLength = buf.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buf.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = buf.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) return Buffer.from(compressed); // STORED
  if (compressionMethod === 8) return inflateRawSync(compressed); // DEFLATE
  throw new UnsupportedZipError(`Unsupported compression method: ${compressionMethod}`);
}
