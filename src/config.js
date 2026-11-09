import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

export const config = {
  rootDir: ROOT_DIR,
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'http://127.0.0.1:20852/v1',
    apiKey: process.env.AI_API_KEY || '',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gemini/gemini-3.8-flash'
  },
  bot: {
    allowedGroupId: process.env.ALLOWED_GROUP_ID || '',
    names: (process.env.BOT_NAMES || 'pinnbot,cow,cil,pin').split(',').map(s => s.trim().toLowerCase()),
    maxMemoryWindow: 30,
    maxLogResetLimit: 50
  },
  server: {
    port: parseInt(process.env.PORT || '20856', 10),
    whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true'
  }
};
