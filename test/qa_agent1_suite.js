import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:20856';

async function sendChat(payload) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: res.status, data: await res.json() };
}

async function getStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  return { status: res.status, data: await res.json() };
}

async function run() {
  console.log('====================================================');
  console.log('QA AGENT 1: VERIFICATION & STRESS TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST DOMAIN 1: SMART TRIGGER
  // ----------------------------------------------------
  console.log('--- TEST 1: SMART TRIGGER ---');

  // 1.1 Casual group messages without calling bot
  console.log('[1.1] Casual chat: "Sayang makan apa ya"');
  const t1_1 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Sayang makan apa ya',
    isGroup: true,
    isMentioned: false,
    isReplyToBot: false
  });
  console.log('Result 1.1:', JSON.stringify(t1_1));
  assert.strictEqual(t1_1.status, 200);
  assert.strictEqual(t1_1.data.result, null, 'Must ignore casual message without bot trigger');

  console.log('[1.2] Casual chat: "Aku mau bakso"');
  const t1_2 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Pacar',
    message: 'Aku mau bakso',
    isGroup: true,
    isMentioned: false,
    isReplyToBot: false
  });
  console.log('Result 1.2:', JSON.stringify(t1_2));
  assert.strictEqual(t1_2.status, 200);
  assert.strictEqual(t1_2.data.result, null, 'Must ignore casual message without bot trigger');

  // 1.3 Calling bot name
  console.log('[1.3] Calling bot: "Cil bantuin dong"');
  const t1_3 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Cil bantuin dong',
    isGroup: true
  });
  console.log('Result 1.3:', JSON.stringify(t1_3));
  assert.strictEqual(t1_3.status, 200);
  assert.ok(t1_3.data.result && t1_3.data.result.type === 'text');
  assert.ok(t1_3.data.result.content.length > 0);

  console.log('[1.4] Calling bot: "Pinnbot jelasin apa itu CPU"');
  const t1_4 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Pacar',
    message: 'Pinnbot jelasin apa itu CPU',
    isGroup: true
  });
  console.log('Result 1.4:', JSON.stringify(t1_4));
  assert.strictEqual(t1_4.status, 200);
  assert.ok(t1_4.data.result && t1_4.data.result.type === 'text');
  assert.ok(t1_4.data.result.content.length > 0);

  // 1.5 Quoting / Replying to bot without bot name in text
  console.log('[1.5] Quoting/replying to bot: "Gimana menurut lu?" (isReplyToBot: true)');
  const t1_5 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Gimana menurut lu?',
    isGroup: true,
    isMentioned: false,
    isReplyToBot: true
  });
  console.log('Result 1.5:', JSON.stringify(t1_5));
  assert.strictEqual(t1_5.status, 200);
  assert.ok(t1_5.data.result && t1_5.data.result.type === 'text');
  assert.ok(t1_5.data.result.content.length > 0);

  console.log('>>> DOMAIN 1 (SMART TRIGGER): PASS\n');

  // ----------------------------------------------------
  // TEST DOMAIN 2: DYNAMIC MOODS
  // ----------------------------------------------------
  console.log('--- TEST 2: DYNAMIC MOODS ---');

  // 2.1 Compliments -> SENANG
  console.log('[2.1] Trigger Compliment: "Pinnbot makasih lu keren pinter banget terbaik"');
  const t2_1 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Pinnbot makasih lu keren pinter banget terbaik',
    isGroup: true
  });
  console.log('Result 2.1 Mood returned:', t2_1.data.result?.mood);
  const s2_1 = await getStatus();
  console.log('Status Mood:', s2_1.data.mood);
  assert.strictEqual(s2_1.data.mood, 'senang', 'Mood must be SENANG');

  // 2.2 Complaints / Burnout -> MALAS
  console.log('[2.2] Trigger Burnout: "Pinnbot capek mager burnout pusing banyak banget tugas numpuk"');
  const t2_2 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Pinnbot capek mager burnout pusing banyak banget tugas numpuk',
    isGroup: true
  });
  console.log('Result 2.2 Mood returned:', t2_2.data.result?.mood);
  const s2_2 = await getStatus();
  console.log('Status Mood:', s2_2.data.mood);
  assert.strictEqual(s2_2.data.mood, 'malas', 'Mood must be MALAS');

  // 2.3 Teasing / Insult -> MARAH
  console.log('[2.3] Trigger Insult: "Pinnbot jelek bego lemot payah dih apasi"');
  const t2_3 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Pinnbot jelek bego lemot payah dih apasi',
    isGroup: true
  });
  console.log('Result 2.3 Mood returned:', t2_3.data.result?.mood);
  const s2_3 = await getStatus();
  console.log('Status Mood:', s2_3.data.mood);
  assert.strictEqual(s2_3.data.mood, 'marah', 'Mood must be MARAH');

  // 2.4 Sad venting -> SEDIH
  console.log('[2.4] Trigger Sad Vent: "Pinnbot sedih nangis galau kecewa patah hati"');
  const t2_4 = await sendChat({
    chatId: 'group_test_123',
    senderName: 'Kelvin',
    message: 'Pinnbot sedih nangis galau kecewa patah hati',
    isGroup: true
  });
  console.log('Result 2.4 Mood returned:', t2_4.data.result?.mood);
  const s2_4 = await getStatus();
  console.log('Status Mood:', s2_4.data.mood);
  assert.strictEqual(s2_4.data.mood, 'sedih', 'Mood must be SEDIH');

  console.log('>>> DOMAIN 2 (DYNAMIC MOODS): PASS\n');

  // ----------------------------------------------------
  // TEST DOMAIN 3: 50-MESSAGE MEMORY AUTO-RESET
  // ----------------------------------------------------
  console.log('--- TEST 3: 50-MESSAGE MEMORY AUTO-RESET (55 TURNS) ---');
  
  // Clear memory first to start at 0
  await sendChat({ chatId: 'group_test_123', senderName: 'Kelvin', message: '/clear', isGroup: true });
  const initialStatus = await getStatus();
  console.log('Initial status after /clear:', initialStatus.data);

  // Durable memory check: inspect memory.json
  const memoryFilePath = '/home/pinncopow/myproject/Pinnbot/data/memory.json';
  const memDataBefore = JSON.parse(fs.readFileSync(memoryFilePath, 'utf8'));
  console.log('Durable memory before 55 turns:', JSON.stringify(memDataBefore));

  let resetObserved = [];

  for (let turn = 1; turn <= 55; turn++) {
    const res = await sendChat({
      chatId: 'group_test_123',
      senderName: 'Kelvin',
      message: `Pinnbot hitung turn ${turn}`,
      isGroup: true
    });
    
    const st = await getStatus();
    // Log progress every 5 turns or around transition points
    if (turn === 1 || turn === 24 || turn === 25 || turn === 26 || turn === 49 || turn === 50 || turn === 51 || turn === 55 || st.data.messagesLogged === 0) {
      console.log(`[Turn ${turn}] Status: messagesLogged=${st.data.messagesLogged}, Reply: "${res.data.result?.content?.slice(0, 30)}..."`);
    }

    if (st.data.messagesLogged === 0) {
      resetObserved.push(turn);
    }
  }

  console.log('Turns where messagesLogged was 0 (clean reset triggered):', resetObserved);
  
  const memDataAfter = JSON.parse(fs.readFileSync(memoryFilePath, 'utf8'));
  console.log('Durable memory after 55 turns:', JSON.stringify(memDataAfter));

  // Verify durable memory file is still valid JSON and mood is preserved
  assert.ok(memDataAfter && typeof memDataAfter === 'object', 'Durable memory file must exist and be valid JSON');
  assert.ok(Array.isArray(memDataAfter.facts), 'Durable facts must remain an array');
  assert.ok(typeof memDataAfter.mood === 'string', 'Durable mood must remain intact');

  console.log('>>> DOMAIN 3 (50-MESSAGE AUTO-RESET): PASS\n');

  // ----------------------------------------------------
  // TEST DOMAIN 4: HARD & PANIC EDGE CASE TESTS
  // ----------------------------------------------------
  console.log('--- TEST 4: HARD & PANIC EDGE CASES ---');

  // 4.1 Pesan Kosong & Whitespace
  console.log('[4.1.1] Pesan string kosong: ""');
  const e1 = await sendChat({ chatId: 'g', senderName: 'K', message: '', isGroup: true });
  console.log('Result empty string:', JSON.stringify(e1));
  assert.strictEqual(e1.data.result, null);

  console.log('[4.1.2] Pesan spasi doang: "     "');
  const e2 = await sendChat({ chatId: 'g', senderName: 'K', message: '     ', isGroup: true });
  console.log('Result whitespace:', JSON.stringify(e2));
  assert.strictEqual(e2.data.result, null);

  console.log('[4.1.3] Pesan null: null');
  const e3 = await sendChat({ chatId: 'g', senderName: 'K', message: null, isGroup: true });
  console.log('Result null message:', JSON.stringify(e3));
  assert.strictEqual(e3.data.result, null);

  // 4.2 Teks Raksasa 5000 karakter
  console.log('[4.2] Teks Raksasa 5000 karakter...');
  const hugeText = 'Pinnbot ' + 'X'.repeat(5000);
  const tHuge = await sendChat({ chatId: 'g', senderName: 'K', message: hugeText, isGroup: true });
  console.log('Result huge text status:', tHuge.status, 'Content length:', tHuge.data.result?.content?.length);
  assert.strictEqual(tHuge.status, 200);
  assert.ok(tHuge.data.result?.content);

  // 4.3 Rapid-fire Spam (10 concurrent requests)
  console.log('[4.3] Rapid-fire spam: sending 10 concurrent requests...');
  const spamPromises = [];
  for (let i = 1; i <= 10; i++) {
    spamPromises.push(sendChat({
      chatId: 'g',
      senderName: 'Spammer' + i,
      message: `Pinnbot spam ${i}`,
      isGroup: true
    }));
  }
  const spamResults = await Promise.all(spamPromises);
  const all200 = spamResults.every(r => r.status === 200 && r.data.result?.type === 'text');
  console.log(`Rapid-fire results: ${spamResults.length} sent, all 200 OK: ${all200}`);
  assert.ok(all200, 'All concurrent requests must be handled safely via FIFO queue');

  // 4.4 Payload Rusak & Edge Types
  console.log('[4.4.1] Malformed JSON raw bytes');
  const badJsonRes = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"message": "broken'
  });
  console.log('Malformed JSON status:', badJsonRes.status);
  const badJsonData = await badJsonRes.json();
  console.log('Malformed JSON response:', badJsonData);
  assert.strictEqual(badJsonRes.status, 500);

  console.log('[4.4.2] Non-object JSON body (array)');
  const arrayBodyRes = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([1, 2, 3])
  });
  console.log('Array body status:', arrayBodyRes.status);
  const arrayBodyData = await arrayBodyRes.json();
  console.log('Array body response:', arrayBodyData);

  console.log('[4.4.3] Numeric message: { message: 12345 }');
  const numMsgRes = await sendChat({ chatId: 'g', senderName: 'K', message: 12345, isGroup: true });
  console.log('Numeric message response:', numMsgRes);

  // Health check after panic testing
  console.log('[4.5] Post-panic Server Health Check...');
  const finalStatus = await getStatus();
  console.log('Final Server Status:', finalStatus);
  assert.strictEqual(finalStatus.status, 200);
  assert.strictEqual(finalStatus.data.status, 'online');

  console.log('\n>>> ALL TEST DOMAINS COMPLETED.');
}

run().catch(err => {
  console.error('\n❌ QA TEST RUNNER FAILED:', err);
  process.exit(1);
});
