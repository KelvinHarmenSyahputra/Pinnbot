import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

export async function createSticker(inputImagePath, outputFilename = `sticker_${Date.now()}.webp`) {
  const outDir = path.join(config.rootDir, 'temp');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, outputFilename);

  // High quality 512x512 webp sticker for WhatsApp
  // Scale and pad maintaining aspect ratio
  const args = [
    '-y',
    '-i', inputImagePath,
    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
    '-c:v', 'libwebp',
    '-preset', 'default',
    '-loop', '0',
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });

    ffmpeg.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg sticker conversion failed (code ${code}): ${stderr}`));
      }
    });
  });
}
