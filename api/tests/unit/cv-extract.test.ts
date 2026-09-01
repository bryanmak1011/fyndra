import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  extractText,
  NoTextLayerError,
  UnsupportedFormatError,
} from '../../src/cv/extract.js';

// All three fixtures are real files, not mocks:
// - sample-cv.pdf: rendered from plain text via `cupsfilter` (macOS/CUPS)
// - sample-cv.docx: converted from the same text via macOS `textutil`
// - blank.pdf: a hand-written, valid, single-page PDF with a zero-length
//   content stream — pdftotext succeeds and returns empty text, exactly
//   the shape of a scanned/image-only PDF's output.
function fixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
}

describe('extractText', () => {
  it('extracts real text from a text-layer PDF via pdftotext', async () => {
    const result = await extractText(fixture('sample-cv.pdf'));
    expect(result.format).toBe('pdf');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('TypeScript');
    expect(result.text).toContain('5 years of experience');
  });

  it('extracts real text from a genuine DOCX (word/document.xml)', async () => {
    const result = await extractText(fixture('sample-cv.docx'));
    expect(result.format).toBe('docx');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('PostgreSQL');
  });

  it('rejects a PDF with no text layer', async () => {
    await expect(extractText(fixture('blank.pdf'))).rejects.toBeInstanceOf(NoTextLayerError);
  });

  it('rejects a file that is neither PDF nor ZIP/DOCX', async () => {
    await expect(extractText(Buffer.from('just some plain bytes'))).rejects.toBeInstanceOf(
      UnsupportedFormatError,
    );
  });

  it('rejects a ZIP file that is not a readable DOCX (no word/document.xml)', async () => {
    // A minimal valid ZIP (PK magic + EOCD only, no entries) — same
    // container format, wrong contents.
    const emptyZip = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, // local file signature (harmless prefix)
      ...Array(18).fill(0),
      0x50, 0x4b, 0x05, 0x06, // EOCD signature
      ...Array(18).fill(0),
    ]);
    await expect(extractText(emptyZip)).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
});
