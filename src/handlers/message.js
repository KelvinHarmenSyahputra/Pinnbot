import { config } from '../config.js';
import { handleCommand } from './commands.js';
import { chatCompletion } from '../ai/router.js';
import { memory } from '../ai/memory.js';
import { taskTracker } from '../tools/tasks.js';
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

  const rawText = (text || '').trim();
  if (!rawText) return null;

  // 2. Command check
  if (rawText.startsWith('/')) {
    const cmdResult = await handleCommand(rawText, { senderName });
    if (cmdResult) return cmdResult;
  }

  // 3. Smart Trigger: Bot only replies if addressed
  const lowerText = rawText.toLowerCase();
  const nameTriggered = config.bot.names.some(name => {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    return regex.test(lowerText);
  });

  const shouldReply = isMentioned || isReplyToBot || nameTriggered || !isGroup;
  if (!shouldReply) {
    // If not addressed to bot, quietly record in background memory for context if needed
    return null;
  }

  // 4. Natural Assignment Tracker Helper (NLP shortcuts)
  if (lowerText.startsWith('ingetin tugas') || lowerText.startsWith('catat tugas')) {
    const taskContent = rawText.replace(/^(ingetin tugas|catat tugas)\s*/i, '').trim();
    if (taskContent) {
      const added = taskTracker.addTask(taskContent, '', senderName);
      return {
        type: 'text',
        content: `✅ Siap! Tugas *"${added.title}"* udah gua catet di daftar tugas. Semangat ngerjainnya!`
      };
    }
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
