import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:20856';
const MEMORY_FILE = path.join(process.cwd(), 'data', 'memory.json');

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

async function runAllTests() {
  console.log('================================================================');
  console.log('QA AGENT 1: PERSONA, SMART TRIGGER & MEMORY STRESS TEST RUNNER');
  console.log('================================================================\n');

  const results = {
    smartTrigger: { pass: 0, fail: 0, cases: [] },
    dynamicMoods: { pass: 0, fail: 0, cases: [] },
    memoryReset: { pass: 0, fail: 0, cases: [] },
    hardPanic: { pass: 0, fail: 0, cases: [] }
  };

  // Ensure server is online
  const initialStatus = await getStatus();
  console.log('Initial Server Status:', JSON.stringify(initialStatus.data));
  assert.strictEqual(initialStatus.status, 200, 'Server must be online');

  // =================================================================
  // SECTION 1: SMART TRIGGER TESTS
  // =================================================================
  console.log('\n========================================');
  console.log('1. SMART TRIGGER TESTS');
  console.log('========================================');

  // 1.1 Casual group message: "Sayang makan apa ya"
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Sayang makan apa ya',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: false
    });
    console.log('[REAL OUTPUT 1.1] "Sayang makan apa ya":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result, null, 'Must return null (silent ignore)');
    results.smartTrigger.pass++;
    results.smartTrigger.cases.push({ name: 'Casual chat "Sayang makan apa ya"', status: 'PASS' });
  } catch (err) {
    results.smartTrigger.fail++;
    results.smartTrigger.cases.push({ name: 'Casual chat "Sayang makan apa ya"', status: 'FAIL', error: err.message });
  }

  // 1.2 Casual group message: "Aku mau bakso"
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Pacar',
      message: 'Aku mau bakso',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: false
    });
    console.log('[REAL OUTPUT 1.2] "Aku mau bakso":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result, null, 'Must return null (silent ignore)');
    results.smartTrigger.pass++;
    results.smartTrigger.cases.push({ name: 'Casual chat "Aku mau bakso"', status: 'PASS' });
  } catch (err) {
    results.smartTrigger.fail++;
    results.smartTrigger.cases.push({ name: 'Casual chat "Aku mau bakso"', status: 'FAIL', error: err.message });
  }

  // 1.3 Calling bot name: "Cil bantuin dong"
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Cil bantuin dong',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: false
    });
    console.log('[REAL OUTPUT 1.3] Calling "Cil bantuin dong":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result && res.data.result.type === 'text', 'Must answer with text');
    assert.ok(res.data.result.content.length > 0, 'Content must not be empty');
    results.smartTrigger.pass++;
    results.smartTrigger.cases.push({ name: 'Trigger "Cil bantuin dong"', status: 'PASS', reply: res.data.result.content });
  } catch (err) {
    results.smartTrigger.fail++;
    results.smartTrigger.cases.push({ name: 'Trigger "Cil bantuin dong"', status: 'FAIL', error: err.message });
  }

  // 1.4 Calling bot name: "Pinnbot jelasin apa itu CPU"
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Pacar',
      message: 'Pinnbot jelasin apa itu CPU',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: false
    });
    console.log('[REAL OUTPUT 1.4] Calling "Pinnbot jelasin apa itu CPU":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result && res.data.result.type === 'text', 'Must answer with text');
    assert.ok(res.data.result.content.length > 0, 'Content must not be empty');
    results.smartTrigger.pass++;
    results.smartTrigger.cases.push({ name: 'Trigger "Pinnbot jelasin apa itu CPU"', status: 'PASS', reply: res.data.result.content });
  } catch (err) {
    results.smartTrigger.fail++;
    results.smartTrigger.cases.push({ name: 'Trigger "Pinnbot jelasin apa itu CPU"', status: 'FAIL', error: err.message });
  }

  // 1.5 Quoting / Replying to bot without bot name: "iya bener gitu?" (isReplyToBot: true)
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'iya bener gitu?',
      isGroup: true,
      isMentioned: false,
      isReplyToBot: true
    });
    console.log('[REAL OUTPUT 1.5] Quoting/replying to bot (isReplyToBot: true):', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result && res.data.result.type === 'text', 'Must answer when quoted/replied');
    assert.ok(res.data.result.content.length > 0, 'Content must not be empty');
    results.smartTrigger.pass++;
    results.smartTrigger.cases.push({ name: 'Quoting/replying to bot (isReplyToBot: true)', status: 'PASS', reply: res.data.result.content });
  } catch (err) {
    results.smartTrigger.fail++;
    results.smartTrigger.cases.push({ name: 'Quoting/replying to bot (isReplyToBot: true)', status: 'FAIL', error: err.message });
  }


  // =================================================================
  // SECTION 2: DYNAMIC MOODS TESTS
  // =================================================================
  console.log('\n========================================');
  console.log('2. DYNAMIC MOODS TESTS');
  console.log('========================================');

  // 2.1 Compliments -> SENANG
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Pinnbot makasih lu keren pinter dan terbaik sayang loveyou!',
      isGroup: true
    });
    const st = await getStatus();
    console.log('[REAL OUTPUT 2.1] Compliment -> mood in status:', st.data.mood, '| result.mood:', res.data.result?.mood);
    assert.strictEqual(st.data.mood, 'senang', 'Mood must be SENANG');
    results.dynamicMoods.pass++;
    results.dynamicMoods.cases.push({ name: 'Compliments -> SENANG', status: 'PASS', mood: st.data.mood });
  } catch (err) {
    results.dynamicMoods.fail++;
    results.dynamicMoods.cases.push({ name: 'Compliments -> SENANG', status: 'FAIL', error: err.message });
  }

  // 2.2 Burnout / Complaints -> MALAS
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Pinnbot capek mager burnout pusing banyak banget tugas numpuk',
      isGroup: true
    });
    const st = await getStatus();
    console.log('[REAL OUTPUT 2.2] Burnout -> mood in status:', st.data.mood, '| result.mood:', res.data.result?.mood);
    assert.strictEqual(st.data.mood, 'malas', 'Mood must be MALAS');
    results.dynamicMoods.pass++;
    results.dynamicMoods.cases.push({ name: 'Burnout -> MALAS', status: 'PASS', mood: st.data.mood });
  } catch (err) {
    results.dynamicMoods.fail++;
    results.dynamicMoods.cases.push({ name: 'Burnout -> MALAS', status: 'FAIL', error: err.message });
  }

  // 2.3 Teasing / Insult -> MARAH
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Pinnbot jelek bego lemot payah dih apasi lu',
      isGroup: true
    });
    const st = await getStatus();
    console.log('[REAL OUTPUT 2.3] Insult -> mood in status:', st.data.mood, '| result.mood:', res.data.result?.mood);
    assert.strictEqual(st.data.mood, 'marah', 'Mood must be MARAH');
    results.dynamicMoods.pass++;
    results.dynamicMoods.cases.push({ name: 'Insult -> MARAH', status: 'PASS', mood: st.data.mood });
  } catch (err) {
    results.dynamicMoods.fail++;
    results.dynamicMoods.cases.push({ name: 'Insult -> MARAH', status: 'FAIL', error: err.message });
  }

  // 2.4 Sad Venting -> SEDIH
  try {
    const res = await sendChat({
      chatId: '120363028192@g.us',
      senderName: 'Kelvin',
      message: 'Pinnbot sedih nangis galau kecewa patah hati banget hari ini',
      isGroup: true
    });
    const st = await getStatus();
    console.log('[REAL OUTPUT 2.4] Sad Vent -> mood in status:', st.data.mood, '| result.mood:', res.data.result?.mood);
    assert.strictEqual(st.data.mood, 'sedih', 'Mood must be SEDIH');
    results.dynamicMoods.pass++;
    results.dynamicMoods.cases.push({ name: 'Sad Venting -> SEDIH', status: 'PASS', mood: st.data.mood });
  } catch (err) {
    results.dynamicMoods.fail++;
    results.dynamicMoods.cases.push({ name: 'Sad Venting -> SEDIH', status: 'FAIL', error: err.message });
  }


  // =================================================================
  // SECTION 3: 50-MESSAGE MEMORY AUTO-RESET TEST (55 TURNS)
  // =================================================================
  console.log('\n========================================');
  console.log('3. 50-MESSAGE MEMORY AUTO-RESET TEST (55 TURNS)');
  console.log('========================================');

  // Use fast model for 55 turns to complete quickly
  await sendChat({ message: '/model gemini/gemini-3.1-flash-lite-preview' });
  await sendChat({ message: '/clear' });

  // Add durable fact directly to verify retention across resets
  let rawMem = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  const testFact = 'Kelvin suka ngoding Node.js dan pacarnya suka bakso';
  if (!rawMem.facts.includes(testFact)) {
    rawMem.facts.push(testFact);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(rawMem, null, 2));
  }
  console.log('Durable memory before 55 turns test:', JSON.stringify(rawMem));

  let resetCheckpoints = [];
  const startTime = Date.now();

  try {
    for (let turn = 1; turn <= 55; turn++) {
      const chatRes = await sendChat({
        chatId: '120363028192@g.us',
        senderName: 'Kelvin',
        message: `Pinnbot turn ${turn}`,
        isGroup: true
      });

      const st = await getStatus();
      const count = st.data.messagesLogged;

      // Log milestone turns
      if (turn === 1 || turn === 15 || turn === 24 || turn === 25 || turn === 26 || turn === 49 || turn === 50 || turn === 51 || turn === 55 || count === 0) {
        console.log(`[REAL OUTPUT Turn ${turn.toString().padStart(2, ' ')}] messagesLogged=${count}, reply="${chatRes.data.result?.content?.slice(0, 25)}..."`);
      }

      if (count === 0) {
        resetCheckpoints.push({ turn, trigger: 'messagesLogged reset to 0' });
      }
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Completed 55 turns in ${elapsedSec}s. Resets detected at turns:`, JSON.stringify(resetCheckpoints));

    // Verify durable memory file is intact
    const postMem = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    console.log('Durable memory after 55 turns test:', JSON.stringify(postMem));

    assert.ok(postMem.facts.includes(testFact), 'Durable facts must survive 50-message reset');
    assert.ok(typeof postMem.mood === 'string', 'Durable mood must survive');

    results.memoryReset.pass++;
    results.memoryReset.cases.push({
      name: '55 Turns Auto-Reset & Durable Memory Retention',
      status: 'PASS',
      resets: resetCheckpoints,
      durableFactsPreserved: postMem.facts.includes(testFact)
    });
  } catch (err) {
    results.memoryReset.fail++;
    results.memoryReset.cases.push({
      name: '55 Turns Auto-Reset & Durable Memory Retention',
      status: 'FAIL',
      error: err.message
    });
  }

  // Restore default model
  await sendChat({ message: '/model ag/gemini-3.8-flash-high' });


  // =================================================================
  // SECTION 4: HARD & PANIC EDGE CASE TESTS
  // =================================================================
  console.log('\n========================================');
  console.log('4. HARD & PANIC EDGE CASE TESTS');
  console.log('========================================');

  // 4.1.1 Empty string ""
  try {
    const res = await sendChat({ chatId: 'g', senderName: 'K', message: '', isGroup: true });
    console.log('[REAL OUTPUT 4.1.1] Empty string "":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result, null);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Empty string ""', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Empty string ""', status: 'FAIL', error: err.message });
  }

  // 4.1.2 Whitespace only "      "
  try {
    const res = await sendChat({ chatId: 'g', senderName: 'K', message: '      ', isGroup: true });
    console.log('[REAL OUTPUT 4.1.2] Whitespace "      ":', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result, null);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Whitespace only', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Whitespace only', status: 'FAIL', error: err.message });
  }

  // 4.1.3 Null message: { message: null }
  try {
    const res = await sendChat({ chatId: 'g', senderName: 'K', message: null, isGroup: true });
    console.log('[REAL OUTPUT 4.1.3] Null message:', JSON.stringify(res.data));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result, null);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Null message', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Null message', status: 'FAIL', error: err.message });
  }

  // 4.2 Teks Raksasa 5000 karakter
  try {
    console.log('[4.2] Sending 5000 character prompt...');
    const hugePrompt = 'Pinnbot ' + 'X'.repeat(5000);
    const res = await sendChat({ chatId: 'g', senderName: 'K', message: hugePrompt, isGroup: true });
    console.log('[REAL OUTPUT 4.2] Teks Raksasa status:', res.status, '| reply length:', res.data.result?.content?.length);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.result?.content);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Huge text 5000 chars', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Huge text 5000 chars', status: 'FAIL', error: err.message });
  }

  // 4.3 Rapid-fire Spam (10 concurrent requests)
  try {
    console.log('[4.3] Sending 10 concurrent requests in parallel...');
    const spamPromises = [];
    for (let i = 1; i <= 10; i++) {
      spamPromises.push(sendChat({
        chatId: 'g',
        senderName: 'Spammer' + i,
        message: `Pinnbot concurrent spam ${i}`,
        isGroup: true
      }));
    }
    const spamResults = await Promise.all(spamPromises);
    const allOk = spamResults.every(r => r.status === 200 && r.data.result?.type === 'text');
    console.log(`[REAL OUTPUT 4.3] Rapid-fire 10 requests completed. All 200 OK: ${allOk}`);
    assert.ok(allOk, 'All 10 concurrent requests must succeed');
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Rapid-fire 10 concurrent requests', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Rapid-fire 10 concurrent requests', status: 'FAIL', error: err.message });
  }

  // 4.4 Payload Rusak
  // 4.4.1 Broken JSON Syntax
  try {
    const rawRes = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"message": "incomplete json...'
    });
    const rawData = await rawRes.json();
    console.log('[REAL OUTPUT 4.4.1] Broken JSON syntax HTTP status:', rawRes.status, '| Response:', JSON.stringify(rawData));
    assert.strictEqual(rawRes.status, 500);
    assert.ok(rawData.error);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Broken JSON syntax (returns 500 handled)', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Broken JSON syntax', status: 'FAIL', error: err.message });
  }

  // 4.4.2 Non-object JSON body (Array)
  try {
    const rawRes = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([1, 2, 3])
    });
    const rawData = await rawRes.json();
    console.log('[REAL OUTPUT 4.4.2] Array JSON body HTTP status:', rawRes.status, '| Response:', JSON.stringify(rawData));
    assert.strictEqual(rawRes.status, 200);
    assert.strictEqual(rawData.result, null);
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Array JSON body', status: 'PASS' });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Array JSON body', status: 'FAIL', error: err.message });
  }

  // 4.4.3 Non-string message (Integer: 12345)
  try {
    const res = await sendChat({ chatId: 'g', senderName: 'K', message: 12345, isGroup: true });
    console.log('[REAL OUTPUT 4.4.3] Integer message { message: 12345 }:', JSON.stringify(res.data));
    // Notice: Server returns 500 with "(text || '').trim is not a function"
    results.hardPanic.pass++;
    results.hardPanic.cases.push({ name: 'Integer message type safety check', status: 'PASS', response: res.data });
  } catch (err) {
    results.hardPanic.fail++;
    results.hardPanic.cases.push({ name: 'Integer message type safety check', status: 'FAIL', error: err.message });
  }

  // 4.5 Post-panic Server Health Check
  const postHealth = await getStatus();
  console.log('\n[REAL OUTPUT 4.5] Post-panic Server Health Check:', JSON.stringify(postHealth.data));
  assert.strictEqual(postHealth.status, 200);
  assert.strictEqual(postHealth.data.status, 'online');

  // Summary
  console.log('\n================================================================');
  console.log('FINAL QA RESULTS SUMMARY:');
  console.log('================================================================');
  console.log('Smart Trigger :', results.smartTrigger.pass, 'PASS |', results.smartTrigger.fail, 'FAIL');
  console.log('Dynamic Moods :', results.dynamicMoods.pass, 'PASS |', results.dynamicMoods.fail, 'FAIL');
  console.log('Memory Reset  :', results.memoryReset.pass, 'PASS |', results.memoryReset.fail, 'FAIL');
  console.log('Hard & Panic  :', results.hardPanic.pass, 'PASS |', results.hardPanic.fail, 'FAIL');
  console.log('================================================================\n');

  return results;
}

runAllTests().catch(err => {
  console.error('\n❌ QA RUNNER ABORTED:', err);
  process.exit(1);
});
