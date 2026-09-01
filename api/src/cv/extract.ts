import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readZipEntry, UnsupportedZipError } from './zip.js';

export class UnsupportedFormatError extends Error {}
export class NoTextLayerError extends Error {}
export class PasswordProtectedError extends Error {}

export interface ExtractedText {
  text: string;
  format: 'pdf' | 'docx';
}

const PDF_MAGIC = Buffer.from('%PDF');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // 'PK\x03\x04'
const MIN_MEANINGFUL_CHARS = 20;

function detectFormat(buf: Buffer): 'pdf' | 'docx' {
  if (buf.subarray(0, 4).equals(PDF_MAGIC)) return 'pdf';
  if (buf.subarray(0, 4).equals(ZIP_MAGIC)) return 'docx'; // narrowed further in extractDocx
  throw new UnsupportedFormatError('File is neither a PDF nor a DOCX (unrecognised magic bytes)');
}

/** FR-001: text-layer PDF or DOCX; scanned/image-only PDFs are out of scope (need OCR). */
export async function extractText(buf: Buffer): Promise<ExtractedText> {
  const format = detectFormat(buf);
  const text = format === 'pdf' ? await extractPdf(buf) : extractDocx(buf);

  if (text.trim().length < MIN_MEANINGFUL_CHARS) {
    throw new NoTextLayerError('No extractable text — likely a scanned/image-only document');
  }
  return { text, format };
}

async function extractPdf(buf: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'fyndra-cv-'));
  const pdfPath = join(dir, 'input.pdf');
  try {
    await writeFile(pdfPath, buf);
    return await runPdftotext(pdfPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPdftotext(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // `-layout` preserves column/row structure (career-ops's intake.mjs
    // precedent); `-` writes to stdout instead of a sibling file.
    const child = spawn('pdftotext', ['-layout', pdfPath, '-']);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));

    child.on('error', reject); // pdftotext not installed, etc.
    child.on('close', (code) => {
      const stderrText = Buffer.concat(stderr).toString('utf8');
      if (/password/i.test(stderrText)) {
        reject(new PasswordProtectedError('PDF requires a password'));
        return;
      }
      if (code !== 0) {
        reject(new Error(`pdftotext exited ${code}: ${stderrText}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

function extractDocx(buf: Buffer): string {
  let xml: Buffer;
  try {
    xml = readZipEntry(buf, 'word/document.xml');
  } catch (err) {
    if (err instanceof UnsupportedZipError) {
      throw new UnsupportedFormatError(`Not a readable DOCX: ${err.message}`);
    }
    throw err;
  }
  return stripDocxXml(xml.toString('utf8'));
}

/**
 * Word wraps each run of text in `<w:t>...</w:t>` and marks paragraph/line
 * breaks with self-closing `<w:p/>`/`<w:br/>` elements — reconstructing
 * exact layout isn't the goal (unlike `pdftotext -layout`), just readable
 * plain text for the LLM interpretation step downstream.
 */
function stripDocxXml(xml: string): string {
  const paragraphBreaks = xml.replace(/<\/w:p>/g, '\n');
  const lineBreaks = paragraphBreaks.replace(/<w:(br|tab)\b[^>]*\/>/g, '\n');
  const textOnly = lineBreaks.replace(/<[^>]+>/g, '');
  return decodeXmlEntities(textOnly);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
