import assert from 'node:assert';
import fs from 'node:fs';
import { processIncomingMessage } from '../src/handlers/message.js';
import { handleCommand } from '../src/handlers/commands.js';
import { taskTracker } from '../src/tools/tasks.js';
import { generateHandwriting } from '../src/tools/handwriting.js';
import { memory } from '../src/ai/memory.js';
import { MOODS } from '../src/ai/prompts.js';

async function runTests() {
  console.log('🧪 Starting Pinnbot Automated Test Suite...\n');

  // Test 1: Command /status
  console.log('[Test 1] Testing /status command...');
  const statusRes = await handleCommand('/status');
  assert.ok(statusRes && statusRes.content.includes('Pinnbot Status'), 'Status response format valid');
  console.log('✓ /status OK\n');

  // Test 2: Task Tracker
  console.log('[Test 2] Testing College Task Tracker...');
  const task = taskTracker.addTask('Makalah Pancasila Bab 2', 'Jumat 23:59', 'Kelvin');
  assert.strictEqual(task.status, 'pending');
  assert.ok(taskTracker.getPendingTasks().some(t => t.id === task.id), 'Task must be in pending list');
  const done = taskTracker.markDone(task.id);
  assert.strictEqual(done.status, 'completed', 'Task marked completed');
  console.log('✓ Task Tracker OK\n');

  // Test 3: Handwriting Folio Generation
  console.log('[Test 3] Testing Text to Double Folio Handwriting...');
  const sampleText = 'Resume Jurnal Sistem Operasi:\n1. Manajemen Memori Virtual\n2. Algoritma Page Replacement FIFO dan LRU.\n3. Implementasi Paging pada Linux Kernel.';
  const imgPath = await generateHandwriting(sampleText, { outputFilename: 'test_output.jpg' });
  assert.ok(fs.existsSync(imgPath), 'Handwriting image must exist');
  const stats = fs.statSync(imgPath);
  assert.ok(stats.size > 50000, 'Handwriting image must have reasonable size');
  console.log(`✓ Handwriting generator OK (Output: ${imgPath}, ${Math.round(stats.size / 1024)} KB)\n`);

  // Test 4: Smart Trigger in Group
  console.log('[Test 4] Testing Smart Trigger filter in group...');
  // Case A: Casual chatter without calling bot -> should ignore
  const ignored = await processIncomingMessage({
    chatId: 'group_test',
    senderName: 'Pacar',
    text: 'Sayang, nanti kita makan apa ya?',
    isGroup: true,
    isMentioned: false,
    isReplyToBot: false
  });
  assert.strictEqual(ignored, null, 'Bot must ignore casual chat not addressed to it');

  // Case B: Calling bot name -> should answer
  console.log('[Test 5] Testing AI Response via 9router (Addressing bot)...');
  const reply = await processIncomingMessage({
    chatId: 'group_test',
    senderName: 'Kelvin',
    text: 'Pinnbot, jelasin singkat apa itu dead lock dalam sistem operasi dong',
    isGroup: true,
    isMentioned: false,
    isReplyToBot: false
  });
  assert.ok(reply && reply.type === 'text', 'Bot must reply when called');
  console.log(`Bot reply:\n"${reply.content}"\n`);
  assert.ok(reply.content.length > 10, 'Reply content should not be empty');
  console.log('✓ AI Chat & Smart Trigger OK\n');

  // Test 6: Dynamic Mood Shift
  console.log('[Test 6] Testing Mood Engine...');
  await processIncomingMessage({
    chatId: 'group_test',
    senderName: 'Kelvin',
    text: 'Pinnbot makasih banyak ya lu emang paling keren dan pinter!',
    isGroup: true
  });
  assert.strictEqual(memory.getMood(), MOODS.SENANG, 'Mood should shift to SENANG after compliments');
  console.log(`✓ Mood successfully shifted to: ${memory.getMood()}\n`);

  // Test 7: Polished Academic PDF Generator (/pdf)
  console.log('[Test 7] Testing Polished Academic PDF (/pdf)...');
  const pdfRes = await handleCommand('/pdf Ringkasan Jaringan Komputer | Model OSI memiliki 7 lapisan mulai dari Physical layer sampai Application layer.');
  assert.strictEqual(pdfRes.type, 'document');
  assert.ok(fs.existsSync(pdfRes.path), 'PDF file must be generated');
  console.log(`✓ Polished PDF OK: ${pdfRes.path}\n`);

  // Test 8: Document & Media Handlers (Sticker & Word conversion)
  console.log('[Test 8] Testing Document & Sticker handlers...');
  const stickerRes = await processIncomingMessage({
    chatId: 'group_test',
    senderName: 'Kelvin',
    text: '/stiker',
    isGroup: true,
    media: { type: 'image', path: imgPath }
  });
  assert.strictEqual(stickerRes.type, 'sticker');
  assert.ok(fs.existsSync(stickerRes.path), 'Sticker file must exist');
  console.log(`✓ Sticker conversion OK: ${stickerRes.path}\n`);

  console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY! All features are connected and functional.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
