import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
            isReplyToBot: payload.isReplyToBot ?? false,
            media: payload.media || null
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
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, normalizeMessageContent } = await import('@whiskeysockets/baileys');
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
        try {
          if (!m.message || m.key.fromMe) continue;

          const normMsg = normalizeMessageContent(m.message) || m.message;
          const chatId = m.key.remoteJid;
          const senderName = m.pushName || 'Anon';
          const msgType = Object.keys(normMsg)[0];

          let rawText = normMsg.conversation ||
            normMsg.extendedTextMessage?.text ||
            normMsg.imageMessage?.caption ||
            normMsg.documentMessage?.caption ||
            normMsg.documentWithCaptionMessage?.message?.documentMessage?.caption || '';

          const contextInfo = normMsg[msgType]?.contextInfo || normMsg.extendedTextMessage?.contextInfo;

          const botPhone = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
          const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0] || '';

          const isMentioned = Boolean(contextInfo?.mentionedJid?.some(j => (botPhone && j.includes(botPhone)) || (botLid && j.includes(botLid))));
          const isReplyToBot = Boolean((botPhone && contextInfo?.participant?.includes(botPhone)) || (botLid && contextInfo?.participant?.includes(botLid)));

          console.log(`\n📩 [WhatsApp IN] from: ${senderName} (${chatId}) | type: ${msgType} | text: "${rawText}" | mention: ${isMentioned} | replyToBot: ${isReplyToBot}`);

          // Check if there is media attached directly or in quoted message
          let media = null;

          const directDoc = normMsg.documentMessage || normMsg.documentWithCaptionMessage?.message?.documentMessage;
          const directImg = normMsg.imageMessage || normMsg.viewOnceMessage?.message?.imageMessage;

          const quotedMsg = normalizeMessageContent(contextInfo?.quotedMessage) || contextInfo?.quotedMessage;
          const quotedDoc = quotedMsg?.documentMessage || quotedMsg?.documentWithCaptionMessage?.message?.documentMessage;
          const quotedImg = quotedMsg?.imageMessage || quotedMsg?.viewOnceMessage?.message?.imageMessage;

          const docMsg = directDoc || quotedDoc;
          const imgMsg = directImg || quotedImg;

          if (docMsg) {
            try {
              const targetMsg = directDoc ? m : {
                key: {
                  id: contextInfo.stanzaId,
                  remoteJid: chatId,
                  participant: contextInfo.participant
                },
                message: { documentMessage: docMsg }
              };
              const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
                reuploadRequest: sock.updateMediaMessage
              });
              const originalName = docMsg.fileName || 'file.bin';
              const tempPath = path.join(config.rootDir, 'temp', `doc_${Date.now()}_${originalName}`);
              fs.writeFileSync(tempPath, buffer);
              media = { type: 'document', path: tempPath, filename: originalName };
            } catch (e) {
              console.error('Failed to download document:', e);
            }
          } else if (imgMsg) {
            try {
              const targetMsg = directImg ? m : {
                key: {
                  id: contextInfo.stanzaId,
                  remoteJid: chatId,
                  participant: contextInfo.participant
                },
                message: { imageMessage: imgMsg }
              };
              const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
                reuploadRequest: sock.updateMediaMessage
              });
              const tempPath = path.join(config.rootDir, 'temp', `img_${Date.now()}.jpg`);
              fs.writeFileSync(tempPath, buffer);
              media = { type: 'image', path: tempPath };
            } catch (e) {
              console.error('Failed to download image:', e);
            }
          }

        const result = await processIncomingMessage({
          chatId,
          senderName,
          text: rawText,
          isGroup: chatId.endsWith('@g.us'),
          isMentioned,
          isReplyToBot,
          media
        });

        if (result) {
          console.log(`📤 [WhatsApp OUT] Replying to ${chatId} with type: ${result.type}`);
          if (result.type === 'text') {
            await sock.sendMessage(chatId, { text: result.content }, { quoted: m });
          } else if (result.type === 'image') {
            await sock.sendMessage(chatId, {
              image: fs.readFileSync(result.path),
              caption: result.caption || ''
            }, { quoted: m });
          } else if (result.type === 'multi_image') {
            for (let p_i = 0; p_i < result.paths.length; p_i++) {
              await sock.sendMessage(chatId, {
                image: fs.readFileSync(result.paths[p_i]),
                caption: p_i === 0 ? result.caption : `📄 Lembar ke-${p_i + 1} dari ${result.paths.length}`
              }, { quoted: m });
            }
          } else if (result.type === 'sticker') {
            await sock.sendMessage(chatId, {
              sticker: fs.readFileSync(result.path)
            }, { quoted: m });
          } else if (result.type === 'document') {
            await sock.sendMessage(chatId, {
              document: fs.readFileSync(result.path),
              mimetype: result.mimetype || 'application/pdf',
              fileName: result.filename || 'document.pdf',
              caption: result.caption || ''
            }, { quoted: m });
          }
        } else {
          console.log(`ℹ️ [WhatsApp IGNORED] Message from ${senderName} was not addressed to bot (trigger filter).`);
        }
      } catch (msgErr) {
        console.error('[WhatsApp] Error handling message:', msgErr);
      }
    }
    });
  } catch (err) {
    console.error('[WhatsApp] Failed to initialize Baileys:', err);
  }
}
