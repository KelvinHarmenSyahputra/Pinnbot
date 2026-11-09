import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

export async function generateHandwriting(text, options = {}) {
  const {
    name = '',
    nim = '',
    date = '',
    outputFilename = `folio_${Date.now()}.jpg`
  } = options;

  const outDir = path.join(config.rootDir, 'temp');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, outputFilename);
  const fontPath = path.join(config.rootDir, 'assets', 'fonts', 'Caveat.ttf');
  const scriptPath = path.join(config.rootDir, 'src', 'tools', 'handwriting.py');

  return new Promise((resolve, reject) => {
    const py = spawn('python3', [
      scriptPath,
      text,
      outputPath,
      fontPath,
      name,
      nim,
      date
    ]);

    let stderr = '';
    py.stderr.on('data', d => { stderr += d.toString(); });

    py.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`Handwriting generation failed (code ${code}): ${stderr}`));
      }
    });
  });
}
