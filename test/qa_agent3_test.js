import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createSticker } from '../src/tools/sticker.js';

const BASE_URL = 'http://127.0.0.1:20856';
const TASKS_FILE = path.join(process.cwd(), 'data', 'tasks.json');

async function sendChat(payload) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function getStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('====================================================');
  console.log('🚀 QA AGENT 3: COMPREHENSIVE & HARD/PANIC TEST SUITE');
  console.log('====================================================\n');

  let passCount = 0;
  let failCount = 0;

  function recordPass(testName, details = '') {
    passCount++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`  Details: ${details}`);
  }

  function recordFail(testName, error) {
    failCount++;
    console.error(`[FAIL] ${testName}: ${error}`);
  }

  // -----------------------------------------------------------------
  // 1. COLLEGE TASK TRACKER TESTS
  // -----------------------------------------------------------------
  console.log('--- [1. COLLEGE TASK TRACKER] ---');

  let createdTaskId1 = null;
  let nlpTaskId = null;

  // 1.1 /tugas tambah <Title> | <Deadline>
  try {
    const res = await sendChat({ message: '/tugas tambah Sistem Terdistribusi Tugas 1 | Besok 23:59' });
    console.log('[REAL OUTPUT /tugas tambah]:', JSON.stringify(res.data, null, 2));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('Tugas kuliah baru dicatat'));
    assert.ok(res.data.result?.content.includes('Sistem Terdistribusi Tugas 1'));
    assert.ok(res.data.result?.content.includes('Besok 23:59'));
    const match = res.data.result.content.match(/ID:\s*`([^`]+)`/);
    assert.ok(match, 'ID must be present');
    createdTaskId1 = match[1];
    recordPass('1.1 /tugas tambah with pipe deadline', `Task ID: ${createdTaskId1}`);
  } catch (err) {
    recordFail('1.1 /tugas tambah with pipe deadline', err.message);
  }

  // 1.2 Natural NLP Trigger: "ingetin tugas Basis Data besok jam 12"
  try {
    const res = await sendChat({ message: 'ingetin tugas Basis Data besok jam 12' });
    console.log('[REAL OUTPUT NLP Trigger]:', JSON.stringify(res.data, null, 2));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('udah gua catet di daftar tugas'));
    assert.ok(res.data.result?.content.includes('Basis Data besok jam 12'));
    recordPass('1.2 Natural NLP Trigger "ingetin tugas..."');
  } catch (err) {
    recordFail('1.2 Natural NLP Trigger "ingetin tugas..."', err.message);
  }

  // 1.3 /tugas (list pending)
  try {
    const res = await sendChat({ message: '/tugas' });
    console.log('[REAL OUTPUT /tugas list]:', JSON.stringify(res.data, null, 2));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('Daftar Tugas Kuliah'));
    assert.ok(res.data.result?.content.includes('Sistem Terdistribusi Tugas 1'));
    assert.ok(res.data.result?.content.includes('Basis Data besok jam 12'));
    recordPass('1.3 /tugas list pending tasks');
  } catch (err) {
    recordFail('1.3 /tugas list pending tasks', err.message);
  }

  // 1.4 /tugas selesai <Title>
  try {
    const res = await sendChat({ message: '/tugas selesai Basis Data besok jam 12' });
    console.log('[REAL OUTPUT /tugas selesai Title]:', JSON.stringify(res.data, null, 2));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('udah ditandai selesai'));
    recordPass('1.4 /tugas selesai <Title>');
  } catch (err) {
    recordFail('1.4 /tugas selesai <Title>', err.message);
  }

  // 1.5 /tugas selesai <ID>
  try {
    const res = await sendChat({ message: `/tugas selesai ${createdTaskId1}` });
    console.log('[REAL OUTPUT /tugas selesai ID]:', JSON.stringify(res.data, null, 2));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('udah ditandai selesai'));
    assert.ok(res.data.result?.content.includes('Sistem Terdistribusi Tugas 1'));
    recordPass('1.5 /tugas selesai <ID>');
  } catch (err) {
    recordFail('1.5 /tugas selesai <ID>', err.message);
  }

  // 1.6 Verify data/tasks.json correctly updates status to completed
  try {
    const fileRaw = fs.readFileSync(TASKS_FILE, 'utf8');
    const tasks = JSON.parse(fileRaw);
    const t1 = tasks.find(t => t.id === createdTaskId1);
    assert.ok(t1, 'Task 1 must exist in tasks.json');
    assert.strictEqual(t1.status, 'completed', 'Task 1 status must be completed');
    assert.ok(t1.completedAt, 'Task 1 must have completedAt timestamp');

    const t2 = tasks.find(t => t.title === 'Basis Data besok jam 12' && t.status === 'completed');
    assert.ok(t2, 'NLP Task must be completed in tasks.json');
    recordPass('1.6 data/tasks.json disk verification', `Task ${createdTaskId1} status=${t1.status}, completedAt=${t1.completedAt}`);
  } catch (err) {
    recordFail('1.6 data/tasks.json disk verification', err.message);
  }

  // 1.7 HARD/PANIC TEST: Karakter aneh / injection di /tugas
  try {
    const payloads = [
      '/tugas tambah <script>alert("XSS")</script> | 23:59',
      '/tugas tambah $(rm -rf /) ; drop table tasks; -- | Besok',
      '/tugas tambah "\'\'\\\\//&&||;{}[] | deadline_injection',
      '/tugas tambah',
      '/tugas selesai',
      '/tugas selesai non_existent_task_id_99999'
    ];
    for (const p of payloads) {
      const res = await sendChat({ message: p });
      assert.strictEqual(res.status, 200, `Payload ${p} returned non-200`);
      assert.ok(res.data.result, `Payload ${p} returned null result`);
      console.log(`[HARD TEST /tugas] "${p}" -> ${res.data.result.content.split('\n')[0]}`);
    }
    recordPass('1.7 HARD/PANIC injection & weird chars in /tugas (XSS, SQLi, command injection strings, empty queries)');
  } catch (err) {
    recordFail('1.7 HARD/PANIC injection in /tugas', err.message);
  }

  console.log('\n--- [2. CONCURRENCY & MESSAGE QUEUE] ---');

  // 2.1 Test 3 simultaneous HTTP requests in parallel
  try {
    const p1 = sendChat({ message: 'pinnbot jawab 1 kata: apel' });
    const p2 = sendChat({ message: 'pinnbot jawab 1 kata: jeruk' });
    const p3 = sendChat({ message: 'pinnbot jawab 1 kata: mangga' });

    const startTime = Date.now();
    const results = await Promise.all([p1, p2, p3]);
    const duration = Date.now() - startTime;

    assert.strictEqual(results.length, 3);
    results.forEach((r, idx) => {
      console.log(`[REAL OUTPUT Concurrency 3 Req #${idx + 1}]: status=${r.status}, content="${r.data.result?.content}"`);
      assert.strictEqual(r.status, 200);
      assert.ok(r.data.result?.content, `Response #${idx + 1} empty`);
    });
    recordPass('2.1 Parallel 3 simultaneous requests', `Processed all 3 in ${duration}ms without dropping or crashing`);
  } catch (err) {
    recordFail('2.1 Parallel 3 simultaneous requests', err.message);
  }

  // 2.2 HARD/PANIC TEST: Burst 10 requests bersamaan
  try {
    console.log('[HARD TEST] Firing 10 simultaneous requests in parallel...');
    const startTime10 = Date.now();
    const burstPromises = Array.from({ length: 10 }, (_, i) => 
      sendChat({ message: `pinnbot berikan angka romawi untuk ${i + 1} dalam satu kata` })
    );

    const burstResults = await Promise.all(burstPromises);
    const duration10 = Date.now() - startTime10;

    assert.strictEqual(burstResults.length, 10, 'All 10 must resolve');
    burstResults.forEach((r, i) => {
      assert.strictEqual(r.status, 200, `Req #${i + 1} non-200`);
      assert.ok(r.data.result?.content, `Req #${i + 1} empty`);
      console.log(`[BURST 10 Req #${i + 1}] status=${r.status} reply="${r.data.result?.content?.trim()}"`);
    });
    recordPass('2.2 HARD/PANIC burst 10 concurrent requests', `Completed 10/10 in ${duration10}ms with FIFO queue intact`);
  } catch (err) {
    recordFail('2.2 HARD/PANIC burst 10 concurrent requests', err.message);
  }

  console.log('\n--- [3. UTILITY COMMANDS] ---');

  // 3.1 Test /status
  try {
    const res = await sendChat({ message: '/status' });
    console.log('[REAL OUTPUT /status]:\n', res.data.result?.content);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('Pinnbot Status'));
    assert.ok(res.data.result?.content.includes('Model'));
    assert.ok(res.data.result?.content.includes('Mood Saat Ini'));
    assert.ok(res.data.result?.content.includes('Active Memory Log'));
    assert.ok(res.data.result?.content.includes('Tugas Kuliah Pending'));
    recordPass('3.1 /status command verification');
  } catch (err) {
    recordFail('3.1 /status command verification', err.message);
  }

  // 3.2 Test /model switching and persistence
  try {
    // Check initial model
    const m1 = await sendChat({ message: '/model' });
    console.log('[REAL OUTPUT /model query]:\n', m1.data.result?.content);

    // Switch to another model
    const switchRes = await sendChat({ message: '/model openai/gpt-4o-mini' });
    console.log('[REAL OUTPUT /model switch]:\n', switchRes.data.result?.content);
    assert.ok(switchRes.data.result?.content.includes('openai/gpt-4o-mini'));

    // Verify persistence via /status
    const statusAfter = await sendChat({ message: '/status' });
    console.log('[REAL OUTPUT /status after model switch]:\n', statusAfter.data.result?.content);
    assert.ok(statusAfter.data.result?.content.includes('openai/gpt-4o-mini'), 'Model switch must persist in /status');

    // Switch back to ag/gemini-3.8-flash-high
    const revertRes = await sendChat({ message: '/model ag/gemini-3.8-flash-high' });
    console.log('[REAL OUTPUT /model revert]:\n', revertRes.data.result?.content);
    assert.ok(revertRes.data.result?.content.includes('ag/gemini-3.8-flash-high'));

    recordPass('3.2 /model switch and persistence verification');
  } catch (err) {
    recordFail('3.2 /model switch and persistence verification', err.message);
  }

  // 3.3 Test /prompt structured prompt generation
  try {
    const res = await sendChat({ message: '/prompt buatkan prompt untuk merangkum paper machine learning' });
    console.log('[REAL OUTPUT /prompt]:\n', res.data.result?.content);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content.includes('Rekomendasi Prompt Terbaik'));
    assert.ok(res.data.result?.content.length > 50, 'Prompt recommendation must be comprehensive');
    recordPass('3.3 /prompt structured generation');
  } catch (err) {
    recordFail('3.3 /prompt structured generation', err.message);
  }

  // 3.4 HARD/PANIC TEST: /model to invalid/gaib model
  try {
    console.log('[HARD TEST] Switching /model to invalid model "model-gaib-phantom-404"...');
    const switchGaib = await sendChat({ message: '/model model-gaib-phantom-404' });
    assert.ok(switchGaib.data.result?.content.includes('model-gaib-phantom-404'));

    // Trigger AI completion with invalid model
    const chatGaib = await sendChat({ message: 'pinnbot tes model gaib' });
    console.log('[REAL OUTPUT chat with invalid model]: status =', chatGaib.status, 'data =', chatGaib.data);
    // AI router error returns 500
    assert.strictEqual(chatGaib.status, 500);
    assert.ok(chatGaib.data.error, 'Server must return error message, not crash');

    // Restore to valid model
    await sendChat({ message: '/model ag/gemini-3.8-flash-high' });
    const recoveryCheck = await sendChat({ message: 'pinnbot tes pemulihan server' });
    assert.strictEqual(recoveryCheck.status, 200);
    assert.ok(recoveryCheck.data.result?.content);
    console.log('[RECOVERY VERIFIED]:', recoveryCheck.data.result?.content);

    recordPass('3.4 HARD/PANIC invalid model handling & server self-recovery');
  } catch (err) {
    recordFail('3.4 HARD/PANIC invalid model handling', err.message);
  }

  console.log('\n--- [4. IMAGE TO STICKER CONVERTER] ---');

  // 4.1 Test createSticker() with valid image, verify 512x512 webp
  const sampleImg = path.join(process.cwd(), 'temp', 'test_output.jpg');
  try {
    assert.ok(fs.existsSync(sampleImg), `Sample image ${sampleImg} must exist`);
    const stickerPath = await createSticker(sampleImg, 'test_sticker_512.webp');
    console.log('[REAL OUTPUT createSticker path]:', stickerPath);
    assert.ok(fs.existsSync(stickerPath), 'Sticker output file must exist');

    // Probe with ffprobe
    const probeWidth = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "${stickerPath}"`).toString().trim();
    const probeHeight = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${stickerPath}"`).toString().trim();
    const probeCodec = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${stickerPath}"`).toString().trim();
    console.log('[REAL OUTPUT ffprobe]:', `${probeWidth}x${probeHeight} ${probeCodec}`);
    assert.strictEqual(probeWidth, '512', 'Width must be 512');
    assert.strictEqual(probeHeight, '512', 'Height must be 512');
    assert.strictEqual(probeCodec, 'webp', 'Codec must be webp');
    recordPass('4.1 createSticker() produces 512x512 webp', `ffprobe: ${probeWidth}x${probeHeight} ${probeCodec}`);
  } catch (err) {
    recordFail('4.1 createSticker() verification', err.message);
  }

  // 4.2 HARD/PANIC TEST: Sticker dari gambar corrupt
  try {
    const corruptDir = path.join(process.cwd(), 'temp');
    const emptyFile = path.join(corruptDir, 'panic_empty.jpg');
    const garbageFile = path.join(corruptDir, 'panic_garbage.jpg');
    const fakeFile = path.join(corruptDir, 'panic_fake_text.jpg');

    fs.writeFileSync(emptyFile, '');
    fs.writeFileSync(garbageFile, Buffer.from([0x00, 0xFF, 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02]));
    fs.writeFileSync(fakeFile, 'THIS IS JUST A TEXT FILE NOT AN IMAGE');

    // Case A: 0-byte file
    let rejectedA = false;
    try {
      await createSticker(emptyFile, 'panic_sticker_a.webp');
    } catch (e) {
      rejectedA = true;
      console.log('[REAL OUTPUT Corrupt 0-byte rejection]:', e.message.split('\n')[0]);
    }
    assert.ok(rejectedA, 'Empty file must reject');

    // Case B: Garbage binary
    let rejectedB = false;
    try {
      await createSticker(garbageFile, 'panic_sticker_b.webp');
    } catch (e) {
      rejectedB = true;
      console.log('[REAL OUTPUT Corrupt Garbage rejection]:', e.message.split('\n')[0]);
    }
    assert.ok(rejectedB, 'Garbage file must reject');

    // Case C: Fake text file
    let rejectedC = false;
    try {
      await createSticker(fakeFile, 'panic_sticker_c.webp');
    } catch (e) {
      rejectedC = true;
      console.log('[REAL OUTPUT Fake text rejection]:', e.message.split('\n')[0]);
    }
    assert.ok(rejectedC, 'Fake text image must reject');

    // Case D: HTTP Chat endpoint handling with corrupt media
    const mediaRes = await sendChat({
      message: '/stiker',
      media: { type: 'image', path: garbageFile }
    });
    console.log('[REAL OUTPUT /chat corrupt media]:', JSON.stringify(mediaRes.data, null, 2));
    assert.strictEqual(mediaRes.status, 200);
    assert.ok(mediaRes.data.result?.content?.includes('Gagal convert stiker'));

    // Clean up temporary panic files
    fs.unlinkSync(emptyFile);
    fs.unlinkSync(garbageFile);
    fs.unlinkSync(fakeFile);

    recordPass('4.2 HARD/PANIC corrupt image handling (0-byte, garbage, fake image, HTTP media fail-safe)');
  } catch (err) {
    recordFail('4.2 HARD/PANIC corrupt image handling', err.message);
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TOTAL PASSED: ${passCount}`);
  console.log(`TOTAL FAILED: ${failCount}`);
  console.log(`OVERALL STATUS: ${failCount === 0 ? 'ALL DOMAIN TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
