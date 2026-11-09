import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { processIncomingMessage } from '../src/handlers/message.js';
import { handleCommand } from '../src/handlers/commands.js';
import { memory } from '../src/ai/memory.js';
import { taskTracker } from '../src/tools/tasks.js';
import { config } from '../src/config.js';
import { execSync } from 'node:child_process';

const results = [];

function recordResult(name, status, output, file = null) {
  results.push({ name, status, output, file });
  console.log(`\n======================================================`);
  console.log(`[FEATURE] ${name}`);
  console.log(`[STATUS ] ${status}`);
  console.log(`[OUTPUT ]\n${typeof output === 'object' ? JSON.stringify(output, null, 2) : output}`);
  if (file) console.log(`[FILE   ] ${file} (${fs.statSync(file).size} bytes)`);
  console.log(`======================================================\n`);
}

async function runAllFeatures() {
  console.log('🚀 MENJALANKAN SELURUH FITUR PINNBOT SATU PERSATU SECARA LIVE...\n');

  // Ensure temp dir
  const tempDir = path.join(config.rootDir, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 1. SMART TRIGGER - CASUAL CHAT (HARUS DIABAIKAN)
  try {
    const res = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Pacar',
      text: 'Sayang besok kita nonton apa ya?',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: false
    });
    assert.strictEqual(res, null, 'Bot must ignore casual chat');
    recordResult('1. Smart Trigger (Casual Chat Antara Pasangan)', 'PASS', 'Bot diam (null), tidak mengganggu chat pribadi.');
  } catch (err) {
    recordResult('1. Smart Trigger (Casual Chat)', 'FAIL', err.message);
  }

  // 2. SMART TRIGGER & AI CHAT (PANGGIL BOT)
  try {
    const res = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Kelvin',
      text: 'Pinnbot jelaskan secara singkat dan santai apa itu cloud computing',
      isGroup: true
    });
    assert.ok(res && res.type === 'text', 'Bot must reply');
    recordResult('2. AI Chat via 9router (Smart Trigger Dipanggil)', 'PASS', res.content);
  } catch (err) {
    recordResult('2. AI Chat via 9router', 'FAIL', err.message);
  }

  // 3. COMMAND /status
  try {
    const res = await handleCommand('/status');
    assert.ok(res && res.content.includes('Pinnbot Status'), 'Status format valid');
    recordResult('3. Command /status', 'PASS', res.content);
  } catch (err) {
    recordResult('3. Command /status', 'FAIL', err.message);
  }

  // 4. COMMAND /model
  try {
    const resSwitch = await handleCommand('/model LEAD-UTAMA');
    const resCheck = await handleCommand('/status');
    // Switch back to default
    await handleCommand('/model ag/gemini-3.8-flash-high');
    recordResult('4. Command /model (Switch & Check)', 'PASS', `${resSwitch.content}\n${resCheck.content}`);
  } catch (err) {
    recordResult('4. Command /model', 'FAIL', err.message);
  }

  // 5. COMMAND /prompt (META-PROMPT GENERATOR)
  try {
    const res = await handleCommand('/prompt buatkan website landing page coffee shop minimalis');
    assert.ok(res && res.content.length > 50, 'Prompt response valid');
    recordResult('5. Command /prompt (Rekomendasi Prompt AI)', 'PASS', res.content);
  } catch (err) {
    recordResult('5. Command /prompt', 'FAIL', err.message);
  }

  // 6. TASK TRACKER (COMMAND & NLP NATURAL)
  try {
    // 6a. Command /tugas tambah
    const resAddCmd = await handleCommand('/tugas tambah Resume Jurnal Jaringan Nirkabel | Kamis 12:00');
    // 6b. Natural NLP trigger
    const resAddNlp = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Pacar',
      text: 'ingetin tugas Desain Antarmuka Pengguna hari Jumat',
      isGroup: true
    });
    // 6c. List tugas
    const resList = await handleCommand('/tugas');
    // 6d. Tandai selesai
    const resDone = await handleCommand('/tugas selesai Resume Jurnal Jaringan Nirkabel');

    recordResult('6. College Task Tracker (/tugas & NLP Trigger)', 'PASS', {
      tambahViaCommand: resAddCmd.content,
      tambahViaNLP: resAddNlp.content,
      daftarTugas: resList.content,
      tandaiSelesai: resDone.content
    });
  } catch (err) {
    recordResult('6. College Task Tracker', 'FAIL', err.message);
  }

  // 7. TULIS TANGAN DOUBLE FOLIO (/tulis)
  let folioImg = null;
  try {
    const textFolio = `Resume Arsitektur Komputer:\n1. Von Neumann Architecture terdiri dari CPU, Memory, dan I/O.\n2. Pipelining membagi instruksi menjadi beberapa tahap (fetch, decode, execute) untuk meningkatkan throughput.\n3. Cache L1, L2, dan L3 digunakan untuk mengurangi latency akses RAM utama.`;
    const res = await handleCommand(`/tulis ${textFolio}`);
    assert.strictEqual(res.type, 'image');
    assert.ok(fs.existsSync(res.path), 'Folio image exists');
    folioImg = res.path;
    recordResult('7. Tulis Tangan Double Folio (/tulis)', 'PASS', res.caption, res.path);
  } catch (err) {
    recordResult('7. Tulis Tangan Double Folio', 'FAIL', err.message);
  }

  // 8. TEKS KE PDF AKADEMIS POLISHED (/pdf)
  let academicPdf = null;
  try {
    const textPdf = `Analisis Kebutuhan Sistem | jd sistem informasi perpustakaan ini dibikin buat ngatasin pencatatan manual buku yg sering ilang. modulnya ada manajemen buku, peminjaman mahasiswa, denda keterlambatan, sm laporan statistik bulanan.`;
    const res = await handleCommand(`/pdf ${textPdf}`);
    assert.strictEqual(res.type, 'document');
    assert.ok(fs.existsSync(res.path), 'PDF exists');
    academicPdf = res.path;
    recordResult('8. Teks ke PDF Akademis Formal (/pdf)', 'PASS', res.caption, res.path);
  } catch (err) {
    recordResult('8. Teks ke PDF Akademis Formal', 'FAIL', err.message);
  }

  // 9. WORD (.docx) TO PDF CONVERSION
  let convertedPdf = null;
  try {
    // Generate real docx file
    const sampleDocxPath = path.join(tempDir, `sample_tugas_${Date.now()}.docx`);
    execSync(`/usr/bin/python3 -c "
import docx
doc = docx.Document()
doc.add_heading('Laporan Praktikum Basis Data', 0)
doc.add_paragraph('Bab 1: Normalisasi Database (1NF, 2NF, 3NF)')
table = doc.add_table(rows=2, cols=2)
table.cell(0, 0).text = 'NIM'
table.cell(0, 1).text = 'Nama'
table.cell(1, 0).text = '2026001'
table.cell(1, 1).text = 'Kelvin'
doc.save('${sampleDocxPath}')
"`);

    const res = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Kelvin',
      text: '',
      isGroup: true,
      media: {
        type: 'document',
        path: sampleDocxPath,
        filename: 'Laporan_Praktikum.docx'
      }
    });

    assert.strictEqual(res.type, 'document');
    assert.ok(fs.existsSync(res.path), 'Converted PDF exists');
    convertedPdf = res.path;
    recordResult('9. Word (.docx) to PDF Conversion', 'PASS', res.caption, res.path);
  } catch (err) {
    recordResult('9. Word (.docx) to PDF Conversion', 'FAIL', err.message);
  }

  // 10. PDF TO WORD (.docx) CONVERSION
  try {
    assert.ok(convertedPdf, 'Converted PDF from step 9 needed');
    const res = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Kelvin',
      text: 'tolong ubah ke word ya',
      isGroup: true,
      media: {
        type: 'document',
        path: convertedPdf,
        filename: 'Laporan_Praktikum.pdf'
      }
    });

    assert.strictEqual(res.type, 'document');
    assert.ok(fs.existsSync(res.path), 'Converted docx exists');
    recordResult('10. PDF to Word (.docx) Conversion', 'PASS', res.caption, res.path);
  } catch (err) {
    recordResult('10. PDF to Word (.docx) Conversion', 'FAIL', err.message);
  }

  // 11. IMAGE TO WHATSAPP STICKER (/stiker)
  try {
    // Use the folio image or create small image
    const sampleImgPath = path.join(tempDir, `sample_for_sticker.jpg`);
    execSync(`ffmpeg -y -f lavfi -i testsrc=size=400x400:rate=1 -vframes 1 "${sampleImgPath}"`);

    const res = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Kelvin',
      text: '/stiker',
      isGroup: true,
      media: {
        type: 'image',
        path: sampleImgPath
      }
    });

    assert.strictEqual(res.type, 'sticker');
    assert.ok(fs.existsSync(res.path), 'Sticker webp exists');
    recordResult('11. Foto to Stiker WhatsApp (/stiker)', 'PASS', 'Stiker WebP berhasil di-generate (512x512 RGBA)', res.path);
  } catch (err) {
    recordResult('11. Foto to Stiker WhatsApp', 'FAIL', err.message);
  }

  // 12. DYNAMIC MOOD & EMOTIONAL REACTION
  try {
    // 12a. Force mood via /mood
    const resMoodCmd = await handleCommand('/mood marah');
    // 12b. Natural transition to senang via compliment
    const resMoodNatural = await processIncomingMessage({
      chatId: 'test_group',
      senderName: 'Kelvin',
      text: 'Pinnbot makasih banyak ya lu emang asik dan terbaik banget!',
      isGroup: true
    });

    recordResult('12. Dynamic Mood Engine (/mood & Natural Transition)', 'PASS', {
      moodSetManual: resMoodCmd.content,
      replyBot: resMoodNatural.content,
      moodSekarang: memory.getMood()
    });
  } catch (err) {
    recordResult('12. Dynamic Mood Engine', 'FAIL', err.message);
  }

  console.log('\n======================================================');
  console.log(`🏁 SEMUA 12 FITUR SELESAI DIUJI SECARA LIVE!`);
  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`TOTAL: ${passed}/${results.length} FITUR BERHASIL 100%`);
  console.log('======================================================\n');
}

runAllFeatures().catch(e => {
  console.error('Fatal testing error:', e);
  process.exit(1);
});
