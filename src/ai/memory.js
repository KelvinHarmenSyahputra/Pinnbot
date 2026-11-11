import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { MOODS } from './prompts.js';

const DATA_DIR = path.join(config.rootDir, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const LAST_DOCS_FILE = path.join(DATA_DIR, 'last_docs.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

function sanitizeChatId(chatId) {
  return String(chatId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

class MemoryManager {
  constructor() {
    this.sessions = new Map(); // chatId -> { messages: [], counter: 0 }
    this.currentMood = MOODS.SANTAI;
    this.durableFacts = [];
    this.lastDocs = {}; // chatId -> { filename, totalPages, text, timestamp }
    this.loadDurableMemory();
    this.loadLastDocs();
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

  loadLastDocs() {
    try {
      if (fs.existsSync(LAST_DOCS_FILE)) {
        this.lastDocs = JSON.parse(fs.readFileSync(LAST_DOCS_FILE, 'utf8')) || {};
      }
    } catch {
      this.lastDocs = {};
    }
  }

  saveLastDocs() {
    try {
      fs.writeFileSync(LAST_DOCS_FILE, JSON.stringify(this.lastDocs, null, 2));
    } catch (err) {
      console.error('Failed to save last docs:', err);
    }
  }

  setLastDocument(chatId, docData) {
    const key = sanitizeChatId(chatId);
    this.lastDocs[key] = {
      filename: docData.filename || 'document.pdf',
      totalPages: docData.totalPages || 1,
      text: docData.text || '',
      updatedAt: new Date().toISOString()
    };
    this.saveLastDocs();
  }

  getLastDocument(chatId) {
    const key = sanitizeChatId(chatId);
    return this.lastDocs[key] || null;
  }

  _getSession(chatId = 'default') {
    const key = sanitizeChatId(chatId);
    if (!this.sessions.has(key)) {
      const sessionFile = path.join(SESSIONS_DIR, `history_${key}.json`);
      let messages = [];
      let counter = 0;
      if (fs.existsSync(sessionFile)) {
        try {
          const raw = fs.readFileSync(sessionFile, 'utf8');
          const data = JSON.parse(raw);
          messages = data.messages || [];
          counter = data.counter || 0;
        } catch {
          messages = [];
          counter = 0;
        }
      }
      this.sessions.set(key, { messages, counter });
    }
    return this.sessions.get(key);
  }

  _saveSession(chatId = 'default') {
    const key = sanitizeChatId(chatId);
    const session = this.sessions.get(key);
    if (!session) return;
    try {
      const sessionFile = path.join(SESSIONS_DIR, `history_${key}.json`);
      fs.writeFileSync(sessionFile, JSON.stringify({
        messages: session.messages,
        counter: session.counter,
        updatedAt: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error(`Failed to save session ${key}:`, err);
    }
  }

  addMessage(role, content, senderName = '', chatId = 'default') {
    const session = this._getSession(chatId);
    session.counter++;

    const formattedContent = senderName ? `[${senderName}]: ${content}` : content;
    session.messages.push({ role, content: formattedContent });

    // Auto-clean after 50 messages on assistant turn completion
    if (session.counter >= config.bot.maxLogResetLimit && role === 'assistant') {
      session.messages = [];
      session.counter = 0;
      console.log(`[Memory] Log counter reached 50 in ${chatId}, session reset cleanly.`);
    } else if (session.messages.length > config.bot.maxMemoryWindow) {
      session.messages = session.messages.slice(-config.bot.maxMemoryWindow);
    }

    this._saveSession(chatId);
  }

  getMessages(chatId = 'default') {
    const session = this._getSession(chatId);
    return [...session.messages];
  }

  clear(chatId = 'default') {
    const session = this._getSession(chatId);
    session.messages = [];
    session.counter = 0;
    this._saveSession(chatId);
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
