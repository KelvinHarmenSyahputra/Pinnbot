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
    senderName = ''
  } = options;

  const currentMood = memory.getMood();
  const facts = memory.getFactsString();
  const systemPrompt = customSystemPrompt || getSystemPrompt(currentMood, facts);

  // Append user message to memory
  memory.addMessage('user', userMessage, senderName);

  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...memory.getMessages()
  ];

  const headers = {
    'Content-Type': 'application/json'
  };

  if (config.ai.apiKey) {
    headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
  }

  const endpoint = `${config.ai.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: activeModel,
      stream: false,
      temperature,
      messages: payloadMessages
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Router Error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || 'Aduh, lagi ngeblank nih...';

  // Append assistant message to memory
  memory.addMessage('assistant', reply);

  return {
    reply,
    model: activeModel,
    mood: currentMood
  };
}
