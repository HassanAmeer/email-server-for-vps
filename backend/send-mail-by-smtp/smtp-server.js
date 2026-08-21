import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { sendOutboundEmail as sendLiveOutboundEmail } from '../send-mail-simple/send-mail-from-generated-mail-from-live.js';
import { sendOutboundEmail as sendLocalOutboundEmail } from '../send-mail-simple/send-mail-from-generated-mail-from-local.js';

const PORT = 2525; // Port for outbound SMTP Relay (Client to VPS)
const credsPath = path.join(process.cwd(), 'backend', 'send-mail-by-smtp', 'credentials.json');

// Load .env file manually if it exists
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const parts = trimmedLine.split("=");
      if (parts.length >= 2) {
        process.env[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    }
  });
}
const IS_LIVE = process.env.live !== "false";
const envText = IS_LIVE ? "LIVE Environment" : "LOCAL Environment";
const sendOutboundEmail = IS_LIVE ? sendLiveOutboundEmail : sendLocalOutboundEmail;

// Helper to check credentials
function authenticateUser(username, password) {
  try {
    if (!fs.existsSync(credsPath)) return null;
    const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const user = (data.users || []).find(u => u.username === username && u.password === password && u.enabled !== false);
    return user || null;
  } catch (error) {
    console.error('[SMTP AUTH ERROR] Failed to read credentials.json', error);
    return null;
  }
}

const server = new SMTPServer({
  // Secure settings
  secure: false, // We will use STARTTLS if the client supports it
  disabledCommands: ["STARTTLS"],
  authOptional: false, // Force authentication
  
  // onAuth is called when a client tries to login
  onAuth(auth, session, callback) {
    const userObj = authenticateUser(auth.username, auth.password);
    if (userObj) {
      console.log(`[SMTP AUTH] User '${auth.username}' logged in successfully.`);
      return callback(null, { user: userObj });
    } else {
      console.log(`[SMTP AUTH] Failed login attempt for user '${auth.username}'.`);
      return callback(new Error('Invalid username or password'));
    }
  },

  // Enforce separate address restriction per user
  onMailFrom(address, session, callback) {
    const sender = address.address;
    const authUser = session.user;
    if (authUser && typeof authUser === 'object') {
      const allowedFrom = authUser.fromEmail || authUser.email || authUser.username;
      if (allowedFrom && allowedFrom !== '*' && allowedFrom.toLowerCase() !== sender.toLowerCase()) {
        console.warn(`[SMTP AUTH BLOCKED] User '${authUser.username}' attempted to send as '${sender}', but is restricted to '${allowedFrom}'`);
        return callback(new Error(`Unauthorized sender address. This account is dedicated to send from ${allowedFrom}`));
      }
    }
    return callback();
  },

  // onData is called when the email body is streamed
  onData(stream, session, callback) {
    // Parse the incoming email stream using mailparser
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error('[SMTP DATA ERROR] Failed to parse incoming email stream', err);
        return callback(new Error('Email parsing failed'));
      }

      try {
        // Extract sender address with envelope fallback
        const from = parsed?.from?.value?.[0]?.address ||
          session?.envelope?.mailFrom?.address ||
          (session?.user && typeof session.user === 'object' ? session.user.username : null) ||
          "noreply@localhost";
        
        // Extract recipient addresses with envelope and CC/BCC fallbacks
        let toAddresses = [];
        if (parsed?.to?.value && Array.isArray(parsed.to.value)) {
          toAddresses.push(...parsed.to.value.map(r => r.address).filter(Boolean));
        }
        if (session?.envelope?.rcptTo && Array.isArray(session.envelope.rcptTo)) {
          toAddresses.push(...session.envelope.rcptTo.map(r => r.address).filter(Boolean));
        }
        if (parsed?.cc?.value && Array.isArray(parsed.cc.value)) {
          toAddresses.push(...parsed.cc.value.map(r => r.address).filter(Boolean));
        }
        if (parsed?.bcc?.value && Array.isArray(parsed.bcc.value)) {
          toAddresses.push(...parsed.bcc.value.map(r => r.address).filter(Boolean));
        }

        // Deduplicate recipient addresses
        toAddresses = Array.from(new Set(toAddresses.map(addr => (addr || "").trim()).filter(Boolean)));

        if (toAddresses.length === 0) {
          console.error('[SMTP DATA ERROR] No recipient address found in email headers or envelope');
          return callback(new Error('No valid recipient found in email envelope or headers'));
        }

        const fromDisplay = parsed?.from?.text || from;
        const toDisplay = parsed?.to?.text || toAddresses.join(", ");
        console.log(`[SMTP DATA] Received email from ${fromDisplay} to ${toDisplay}`);

        // Safely parse attachments
        const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments.map(att => {
          if (!att || typeof att !== "object") return null;
          let base64Content = "";
          if (Buffer.isBuffer(att.content)) {
            base64Content = att.content.toString("base64");
          } else if (typeof att.content === "string") {
            const trimmed = att.content.trim();
            if (trimmed.length > 0 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
              base64Content = trimmed;
            } else {
              base64Content = Buffer.from(att.content, "utf8").toString("base64");
            }
          }
          return {
            filename: att.filename || "attachment.dat",
            content: base64Content,
            contentType: att.contentType || "application/octet-stream"
          };
        }).filter(Boolean) : [];

        // Send email individually to each recipient using outbound script
        for (const to of toAddresses) {
          console.log(`[SMTP RELAY] Relaying email to ${to}...`);

          await sendOutboundEmail({
            from: from,
            to: to,
            subject: parsed?.subject || "(No Subject)",
            text: parsed?.text || "",
            html: parsed?.html || "",
            attachments: attachments,
            logCallback: (msg) => console.log(msg)
          });
        }
        
        console.log(`[SMTP RELAY] Successfully relayed email to all recipients.`);
        callback(null, 'Message accepted and relayed');
      } catch (error) {
        console.error(`[SMTP RELAY ERROR] Failed to relay email:`, error.message);
        callback(new Error(`Relay failed: ${error.message}`));
      }
    });
  }
});

server.on('error', (err) => {
  console.error('[SMTP SERVER ERROR]', err.message);
});

server.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🚀 [ON-SMTP] Outbound Relay Server Running`);
  console.log(`🌍 Context: ${envText}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`🔐 Authentication: Required`);
  console.log(`📄 Credentials: send-mail-by-smtp/credentials.json`);
  console.log(`==========================================`);
});
