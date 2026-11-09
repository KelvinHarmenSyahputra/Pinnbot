import http from 'node:http';
import { config } from './config.js';
import { processIncomingMessage } from './handlers/message.js';
import { memory } from './ai/memory.js';

console.log('='.repeat(50));
console.log('🚀 Pinnbot Backend Engine Initialized');
console.log(`• AI Endpoint  : ${config.ai.baseUrl}`);
console.log(`• Default Model: ${config.ai.defaultModel}`);
console.log(`• Group Lock   : ${config.bot.allowedGroupId || '(Open/Test Mode)'}`);
console.log(`• Mode         : ${config.server.whatsappEnabled ? 'WhatsApp Multi-Device' : 'Local Test Engine (HTTP)'}`);
console.log('='.repeat(50));

if (config.server.whatsappEnabled) {
  startWhatsApp();
} else {
  startLocalServer();
}

function startLocalServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/chat') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await processIncomingMessage({
            chatId: payload.chatId || 'test_group',
            senderName: payload.senderName || 'Kelvin',
            text: payload.message || '',
            isGroup: payload.isGroup ?? true,
            isMentioned: payload.isMentioned ?? false,
            isReplyToBot: payload.isReplyToBot ?? false
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        mood: memory.getMood(),
        messagesLogged: memory.getMessages().length
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(config.server.port, '127.0.0.1', () => {
    console.log(`[Pinnbot] Local test server listening on http://127.0.0.1:${config.server.port}`);
  });
}

async function startWhatsApp() {
  console.log('[Pinnbot] Starting Baileys WhatsApp connection...');
  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
    const qrcode = (await import('qrcode-terminal')).default;
    const pino = (await import('pino')).default;

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('\n[WhatsApp] Scan QR Code ini di WhatsApp kamu:\n');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('[WhatsApp] Connection closed. Reconnecting?', shouldReconnect);
        if (shouldReconnect) startWhatsApp();
      } else if (connection === 'open') {
        console.log('✅ [WhatsApp] Connected successfully!');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;

        const chatId = m.key.remoteJid;
        const senderName = m.pushName || 'Anon';
        const rawText = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';

        const contextInfo = m.message.extendedTextMessage?.contextInfo;
        const isMentioned = contextInfo?.mentionedJid?.includes(sock.user?.id.split(':')[0] + '@s.whatsapp.net');
        const isReplyToBot = contextInfo?.participant === (sock.user?.id.split(':')[0] + '@s.whatsapp.net');

        const result = await processIncomingMessage({
          chatId,
          senderName,
          text: rawText,
          isGroup: chatId.endsWith('@g.us'),
          isMentioned,
          isReplyToBot
        });

        if (result) {
          if (result.type === 'text') {
            await sock.sendMessage(chatId, { text: result.content }, { quoted: m });
          } else if (result.type === 'image') {
            const fs = await import('node:fs');
            await sock.sendMessage(chatId, {
              image: fs.readFileSync(result.path),
              caption: result.caption || ''
            }, { quoted: m });
          }
        }
      }
    });
  } catch (err) {
    console.error('[WhatsApp] Failed to initialize Baileys:', err);
  }
}
