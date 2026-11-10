import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

export async function generateHandwriting(text, options = {}) {
  const {
    name = '',
    nim = '',
    date = '',
    font = '',
    paperType = 'b5',
    outputFilename = `folio_${Date.now()}.jpg`
  } = options;

  const outDir = path.join(config.rootDir, 'temp');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, outputFilename);
  const fontPath = font ? path.join(config.rootDir, 'assets', 'fonts', font) : '';
  const scriptPath = path.join(config.rootDir, 'src', 'tools', 'handwriting.py');

  return new Promise((resolve, reject) => {
    const py = spawn('/usr/bin/python3', [
      scriptPath,
      text,
      outputPath,
      fontPath,
      name,
      nim,
      date,
      paperType
    ]);

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', d => { stdout += d.toString(); });
    py.stderr.on('data', d => { stderr += d.toString(); });

    py.on('close', code => {
      console.log("PY_STDOUT:", stdout.trim());
      if (stderr) console.error("PY_STDERR:", stderr.trim());
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`Handwriting generation failed (code ${code}): ${stderr}`));
      }
    });
  });
}
