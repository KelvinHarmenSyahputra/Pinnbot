import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { MOODS } from './prompts.js';

const DATA_DIR = path.join(config.rootDir, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class MemoryManager {
  constructor() {
    this.messages = [];
    this.totalCounter = 0;
    this.currentMood = MOODS.SANTAI;
    this.durableFacts = [];
    this.loadDurableMemory();
  }

  loadDurableMemory() {
    try {
      if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.durableFacts = parsed.facts || [];
        this.currentMood = parsed.mood || MOODS.SANTAI;
      }
    } catch {
      this.durableFacts = [];
    }
  }

  saveDurableMemory() {
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify({
        facts: this.durableFacts,
        mood: this.currentMood,
        updatedAt: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('Failed to save durable memory:', err);
    }
  }

  addMessage(role, content, senderName = '') {
    this.totalCounter++;

    // Format sender name if provided
    const formattedContent = senderName ? `[${senderName}]: ${content}` : content;
    this.messages.push({ role, content: formattedContent });

    // Auto-clean: after 50 messages, reset recent chat log
    if (this.totalCounter >= config.bot.maxLogResetLimit) {
      this.messages = [];
      this.totalCounter = 0;
      console.log(`[Memory] Log counter reached 50, chat window reset cleanly.`);
    } else if (this.messages.length > config.bot.maxMemoryWindow) {
      // Sliding window
      this.messages = this.messages.slice(-config.bot.maxMemoryWindow);
    }
  }

  getMessages() {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
    this.totalCounter = 0;
  }

  getFactsString() {
    return this.durableFacts.map(f => `- ${f}`).join('\n');
  }

  addFact(fact) {
    if (!this.durableFacts.includes(fact)) {
      this.durableFacts.push(fact);
      this.saveDurableMemory();
    }
  }

  setMood(mood) {
    if (Object.values(MOODS).includes(mood)) {
      this.currentMood = mood;
      this.saveDurableMemory();
    }
  }

  getMood() {
    return this.currentMood;
  }
}

export const memory = new MemoryManager();
