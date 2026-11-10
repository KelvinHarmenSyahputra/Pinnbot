import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

const SCRIPT_PATH = path.join(config.rootDir, 'src', 'tools', 'docs_converter.py');
const TEMP_DIR = path.join(config.rootDir, 'temp');

function runPython(args) {
  return new Promise((resolve, reject) => {
    const py = spawn('/usr/bin/python3', [SCRIPT_PATH, ...args]);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', d => { stdout += d.toString(); });
    py.stderr.on('data', d => { stderr += d.toString(); });

    py.on('close', code => {
      if (code === 0 && stdout.includes('SUCCESS:')) {
        const match = stdout.match(/SUCCESS:(.+)/);
        resolve(match ? match[1].trim() : '');
      } else {
        reject(new Error(`Doc conversion failed (code ${code}): ${stderr || stdout}`));
      }
    });
  });
}

export async function convertTextToPdf(title, textContent, outputFilename = `doc_${Date.now()}.pdf`) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  const tempTxt = path.join(TEMP_DIR, `temp_${Date.now()}.txt`);
  fs.writeFileSync(tempTxt, textContent, 'utf8');

  const outPdf = path.join(TEMP_DIR, outputFilename);
  try {
    const res = await runPython(['text_to_pdf', title, tempTxt, outPdf]);
    return res;
  } finally {
    if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
  }
}

export async function convertDocxToPdf(docxPath) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  return await runPython(['docx_to_pdf', docxPath, TEMP_DIR]);
}

export async function convertPdfToDocx(pdfPath, outputFilename = `converted_${Date.now()}.docx`) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const outDocx = path.join(TEMP_DIR, outputFilename);
  return await runPython(['pdf_to_docx', pdfPath, outDocx]);
}

export async function readPdfContent(pdfPath) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const outJson = path.join(TEMP_DIR, `pdf_text_${Date.now()}.json`);
  try {
    await runPython(['extract_pdf', pdfPath, outJson]);
    if (fs.existsSync(outJson)) {
      const data = JSON.parse(fs.readFileSync(outJson, 'utf8'));
      return data;
    }
    return { totalPages: 0, text: '' };
  } finally {
    if (fs.existsSync(outJson)) fs.unlinkSync(outJson);
  }
}
