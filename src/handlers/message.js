import { config } from '../config.js';
import { handleCommand } from './commands.js';
import { chatCompletion } from '../ai/router.js';
import { memory } from '../ai/memory.js';
import { taskTracker } from '../tools/tasks.js';
import { createSticker } from '../tools/sticker.js';
import { convertDocxToPdf, convertPdfToDocx, readPdfContent } from '../tools/docs.js';
import { MOODS } from '../ai/prompts.js';

// FIFO queue for anti-collision
let isProcessing = false;
const messageQueue = [];

export async function processIncomingMessage(msgContext) {
  const {
    chatId,
    senderName,
    text,
    isGroup,
    isMentioned = false,
    isReplyToBot = false
  } = msgContext;

  // 1. Strict Group Lockdown (if configured)
  if (config.bot.allowedGroupId && chatId !== config.bot.allowedGroupId) {
    return null; // Silent ignore
  }

  const rawText = (typeof text === 'string' ? text : String(text || '')).trim();

  // Media processing (Stickers, Word to PDF, PDF to Word)
  const media = msgContext.media;
  if (media) {
    if (media.type === 'image' && (rawText.startsWith('/stiker') || rawText.includes('stiker'))) {
      try {
        const stickerPath = await createSticker(media.path);
        return { type: 'sticker', path: stickerPath };
      } catch (err) {
        return { type: 'text', content: `❌ Gagal convert stiker: ${err.message}` };
      }
    }
    if (media.type === 'document' && media.filename) {
      const lowerFile = media.filename.toLowerCase();
      if (lowerFile.endsWith('.docx')) {
        const pdfPath = await convertDocxToPdf(media.path);
        return {
          type: 'document',
          path: pdfPath,
          filename: media.filename.replace(/\.docx$/i, '.pdf'),
          caption: '📄 Nih file Word (.docx) udah di-convert ke PDF rapi!'
        };
      }
      if (lowerFile.endsWith('.pdf')) {
        if (rawText.toLowerCase().includes('word') || rawText.toLowerCase().includes('docx') || rawText.startsWith('/word')) {
          const docxPath = await convertPdfToDocx(media.path);
          return {
            type: 'document',
            path: docxPath,
            filename: media.filename.replace(/\.pdf$/i, '.docx'),
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            caption: '📝 Nih file PDF udah di-convert ke Word (.docx) yang bisa diedit!'
          };
        }

        // Read & Analyze PDF content with AI
        try {
          const pdfData = await readPdfContent(media.path);
          if (!pdfData.text) {
            return {
              type: 'text',
              content: '📄 File PDF ini ga ada teks digitalnya (mungkin hasil scan/foto tanpa OCR). Coba kirim PDF yang teksnya bisa diseleksi/dicopy ya!'
            };
          }

          const userInstruction = rawText || 'Tolong baca, rangkum, dan jelaskan poin-poin penting isi dokumen ini dengan jelas dan santai.';
          const prompt = `Pengguna mengirimkan file PDF "${media.filename}" (${pdfData.totalPages} halaman).\n\n[ISI DOKUMEN PDF]:\n${pdfData.text}\n\n[INSTRUKSI PENGGUNA]:\n${userInstruction}`;

          const aiRes = await chatCompletion(prompt, { senderName });
          return {
            type: 'text',
            content: `📑 *Analisis PDF: ${media.filename}* (${pdfData.totalPages} hal)\n\n${aiRes.reply}`
          };
        } catch (pdfErr) {
          return {
            type: 'text',
            content: `❌ Gagal membaca dokumen PDF: ${pdfErr.message}`
          };
        }
      }
    }
  }

  if (!rawText) return null;

  // 2. Command check
  if (rawText.startsWith('/')) {
    const cmdResult = await handleCommand(rawText, { senderName });
    if (cmdResult) return cmdResult;
  }

  const lowerText = rawText.toLowerCase();

  // 3. Natural Assignment Tracker Helper (NLP shortcuts)
  const isTaskNlp = /^(?:(?:pinnbot|cow|cil|pin)[,\s]+)?(?:ingetin tugas|catat tugas)\b/i.test(lowerText);
  if (isTaskNlp) {
    const taskContent = rawText.replace(/^(?:(?:pinnbot|cow|cil|pin)[,\s]+)?(?:ingetin tugas|catat tugas)\s*/i, '').trim();
    if (taskContent) {
      let title = taskContent;
      let deadline = '';
      if (taskContent.includes('|')) {
        const split = taskContent.split('|');
        title = split[0].trim();
        deadline = split[1].trim();
      }
      const added = taskTracker.addTask(title, deadline, senderName);
      return {
        type: 'text',
        content: `✅ Siap! Tugas *"${added.title}"* ${deadline ? `(Deadline: ${deadline}) ` : ''}udah gua catet di daftar tugas. Semangat ngerjainnya!`
      };
    }
  }

  // 4. Smart Trigger: Bot only replies if addressed
  const nameTriggered = config.bot.names.some(name => {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    return regex.test(lowerText);
  });

  const shouldReply = isMentioned || isReplyToBot || nameTriggered || !isGroup;
  if (!shouldReply) {
    // If not addressed to bot, quietly record in background memory for context if needed
    return null;
  }

  // 5. Dynamic Mood Shift detector based on conversational context
  if (/\b(makasih|keren|pinter|terbaik|loveyou|sayang|hebat)\b/i.test(lowerText)) {
    memory.setMood(MOODS.SENANG);
  } else if (/\b(capek|mager|burnout|banyak banget tugas|pusing|tugas numpuk)\b/i.test(lowerText)) {
    memory.setMood(MOODS.MALAS);
  } else if (/\b(jelek|bego|lemot|payah|dih|apasi)\b/i.test(lowerText)) {
    memory.setMood(MOODS.MARAH);
  } else if (/\b(sedih|nangis|kecewa|galau|patah hati)\b/i.test(lowerText)) {
    memory.setMood(MOODS.SEDIH);
  }

  // 6. Clean call name from prompt so AI focuses on content
  let cleanPrompt = rawText;
  config.bot.names.forEach(n => {
    cleanPrompt = cleanPrompt.replace(new RegExp(`\\b${n}\\b`, 'gi'), '').trim();
  });
  if (!cleanPrompt) cleanPrompt = rawText;

  // 7. Enqueue message to prevent race conditions
  return new Promise((resolve, reject) => {
    messageQueue.push({
      prompt: cleanPrompt,
      senderName,
      resolve,
      reject
    });
    triggerQueue();
  });
}

async function triggerQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;

  const item = messageQueue.shift();
  try {
    const res = await chatCompletion(item.prompt, { senderName: item.senderName });
    item.resolve({
      type: 'text',
      content: res.reply,
      mood: res.mood,
      model: res.model
    });
  } catch (err) {
    item.reject(err);
  } finally {
    isProcessing = false;
    if (messageQueue.length > 0) {
      setTimeout(triggerQueue, 300);
    }
  }
}
