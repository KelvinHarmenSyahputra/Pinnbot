import { config } from '../config.js';
import { getSystemPrompt } from './prompts.js';
import { memory } from './memory.js';

let activeModel = config.ai.defaultModel;

export function getActiveModel() {
  return activeModel;
}

export function setActiveModel(modelName) {
  activeModel = modelName;
  return activeModel;
}

export async function chatCompletion(userMessage, options = {}) {
  const {
    customSystemPrompt = null,
    temperature = 0.7,
    senderName = '',
    chatId = 'default'
  } = options;

  const currentMood = memory.getMood();
  const facts = memory.getFactsString();
  let systemPrompt = customSystemPrompt || getSystemPrompt(currentMood, facts);

  // If there is a cached last document in this chat, remind AI about it
  const lastDoc = memory.getLastDocument(chatId);
  if (lastDoc && lastDoc.text) {
    systemPrompt += `\n\n[DOKUMEN AKTIF TERAKHIR DI CHAT INI: "${lastDoc.filename}"]:\n${lastDoc.text.slice(0, 8000)}\n(Gunakan isi dokumen di atas jika user menanyakan tugas, materi, atau soal terkait dokumen/PDF tersebut)`;
  }

  // Append user message to memory
  memory.addMessage('user', userMessage, senderName, chatId);

  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...memory.getMessages(chatId)
  ];

  const headers = {
    'Content-Type': 'application/json'
  };

  if (config.ai.apiKey) {
    headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
  }

  const endpoint = `${config.ai.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeModel,
          stream: false,
          temperature,
          messages: payloadMessages
        }),
        signal: AbortSignal.timeout(60000)
      });
      break;
    } catch (err) {
      if (attempt === 0 && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        continue;
      }
      throw err;
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Router Error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || 'Aduh, lagi ngeblank nih...';

  // Append assistant message to memory
  memory.addMessage('assistant', reply, '', chatId);

  return {
    reply,
    model: activeModel,
    mood: currentMood
  };
}
