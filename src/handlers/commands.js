import { getActiveModel, setActiveModel, chatCompletion } from '../ai/router.js';
import { memory } from '../ai/memory.js';
import { taskTracker } from '../tools/tasks.js';
import { generateHandwriting } from '../tools/handwriting.js';
import { convertTextToPdf } from '../tools/docs.js';
import { MOODS, getPromptEngineerPrompt } from '../ai/prompts.js';

export async function handleCommand(cmdText, options = {}) {
  const parts = cmdText.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/status': {
      const model = getActiveModel();
      const mood = memory.getMood();
      const memCount = memory.getMessages().length;
      const pendingTasks = taskTracker.getPendingTasks().length;

      return {
        type: 'text',
        content: `🤖 *Pinnbot Status*\n\n` +
          `• *Model*: \`${model}\`\n` +
          `• *Mood Saat Ini*: \`${mood.toUpperCase()}\`\n` +
          `• *Active Memory Log*: ${memCount}/30 (Counter: ${memory.totalCounter}/50)\n` +
          `• *Tugas Kuliah Pending*: ${pendingTasks} tugas\n` +
          `• *Status Sistem*: Ready 24/7 di VPS 🚀`
      };
    }

    case '/model': {
      if (!args) {
        return {
          type: 'text',
          content: `Model saat ini: \`${getActiveModel()}\`\n\nUntuk ganti model, ketik:\n\`/model <nama_model>\`\nContoh: \`/model LEAD-UTAMA\` atau \`/model gemini/gemini-3.8-flash\``
        };
      }
      setActiveModel(args.trim());
      return {
        type: 'text',
        content: `✅ Model berhasil diubah ke: \`${getActiveModel()}\``
      };
    }

    case '/mood': {
      const target = args.toLowerCase().trim();
      if (!Object.values(MOODS).includes(target)) {
        return {
          type: 'text',
          content: `Mood tidak valid. Pilihan mood: ${Object.values(MOODS).join(', ')}`
        };
      }
      memory.setMood(target);
      return {
        type: 'text',
        content: `🎭 Mood Pinnbot sekarang: *${target.toUpperCase()}*`
      };
    }

    case '/prompt': {
      if (!args) {
        return {
          type: 'text',
          content: `Ketik ide atau instruksi kasarnya setelah command, contoh:\n\`/prompt buatkan artikel tentang machine learning untuk pemula\``
        };
      }
      const res = await chatCompletion(args, {
        customSystemPrompt: getPromptEngineerPrompt(),
        temperature: 0.5
      });
      return {
        type: 'text',
        content: `✨ *Rekomendasi Prompt Terbaik:*\n\n${res.reply}`
      };
    }

    case '/tugas': {
      if (args.startsWith('selesai') || args.startsWith('done')) {
        const query = args.replace(/^(selesai|done)\s*/i, '').trim();
        if (!query) {
          return { type: 'text', content: 'Sebutin ID atau judul tugas yang udah selesai ya!' };
        }
        const done = taskTracker.markDone(query);
        if (done) {
          return {
            type: 'text',
            content: `🎉 Mantap! Tugas *"${done.title}"* udah ditandai selesai! Beban berkurang satu cuy~`
          };
        }
        return {
          type: 'text',
          content: `Tugas "${query}" ga ketemu di daftar pending nih. Coba cek \`/tugas\` lagi.`
        };
      }

      if (args.startsWith('tambah') || args.startsWith('add')) {
        const rest = args.replace(/^(tambah|add)\s*/i, '').trim();
        // Syntax: /tugas tambah <Judul> [deadline: ...]
        let title = rest;
        let deadline = '';
        if (rest.includes('|')) {
          const split = rest.split('|');
          title = split[0].trim();
          deadline = split[1].trim();
        }
        const created = taskTracker.addTask(title, deadline);
        return {
          type: 'text',
          content: `✅ Tugas kuliah baru dicatat:\n• *${created.title}* ${deadline ? `(Deadline: ${deadline})` : ''}\n• ID: \`${created.id}\``
        };
      }

      return {
        type: 'text',
        content: taskTracker.formatTaskList()
      };
    }

    case '/tulis': {
      if (!args) {
        return {
          type: 'text',
          content: `Ketik teks yang mau ditulis di kertas setelah command, contoh:\n\`/tulis Rangkuman Koperasi Bab 1...\`\n\nAtau pilih format:\n• \`/tulis b5 <teks>\` (Kertas Binder Loose Leaf B5 rapi)\n• \`/tulis sidu <teks>\` (Kertas Buku Sinar Dunia cepat)`
        };
      }

      let paperType = 'b5';
      let font = 'PlaypenSans.ttf';
      let textContent = args;

      if (args.startsWith('sidu ') || args.startsWith('folio ')) {
        paperType = 'sidu';
        font = 'Caveat.ttf';
        textContent = args.replace(/^(sidu|folio)\s+/i, '');
      } else if (args.startsWith('b5 ')) {
        paperType = 'b5';
        font = 'PlaypenSans.ttf';
        textContent = args.replace(/^b5\s+/i, '');
      }

      const imgPath = await generateHandwriting(textContent, { paperType, font });
      return {
        type: 'image',
        path: imgPath,
        caption: `📝 Nih hasil tulisan tangan di kertas ${paperType === 'b5' ? 'Loose Leaf B5' : 'Sinar Dunia'}! Rapi, lurus di atas garis, dan ga keluar margin.`
      };
    }

    case '/pdf': {
      if (!args) {
        return {
          type: 'text',
          content: `Ketik teks yang mau dijadikan PDF, contoh:\n\`/pdf Rangkuman Jurnal Sistem Operasi | Isi materi tentang scheduling...\``
        };
      }
      let title = 'Tugas Kuliah';
      let content = args;
      if (args.includes('|')) {
        const split = args.split('|');
        title = split[0].trim();
        content = split.slice(1).join('|').trim();
      }

      // AI polish step
      const polished = await chatCompletion(
        `Rapikan teks berikut menjadi paragraf formal akademis yang terstruktur rapi, tanpa kata-kata pengantar/basa-basi, langsung teks intinya saja:\n\n${content}`,
        { temperature: 0.3 }
      );

      const pdfPath = await convertTextToPdf(title, polished.reply);
      return {
        type: 'document',
        path: pdfPath,
        filename: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        caption: `📄 *${title}*\nSudah disempurnakan dan diformat rapi jadi PDF siap kumpul!`
      };
    }

    case '/clear': {
      memory.clear();
      return {
        type: 'text',
        content: '🧹 Log percakapan aktif berhasil dibersihkan! Mulai topik baru dari nol.'
      };
    }

    default:
      return null;
  }
}
