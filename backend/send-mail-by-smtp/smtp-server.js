import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { sendOutboundEmail } from '../send-mail-simple/send-mail-from-generated-mail-from-live.js';

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
    let emailData = [];
    
    // Parse the incoming email stream using mailparser
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error('[SMTP DATA ERROR] Failed to parse incoming email stream', err);
        return callback(new Error('Email parsing failed'));
      }

      console.log(`[SMTP DATA] Received email from ${parsed.from.text} to ${parsed.to.text}`);

      try {
        // Extract the required fields for our outbound sender
        const from = parsed.from.value[0].address;
        
        // Handle multiple recipients
        const toAddresses = parsed.to.value.map(recipient => recipient.address);
        
        // Send email individually to each recipient using our outbound script
        // which includes DKIM signing and direct MX delivery
        for (const to of toAddresses) {
          console.log(`[SMTP RELAY] Relaying email to ${to}...`);
          
          const attachments = parsed.attachments ? parsed.attachments.map(att => ({
            filename: att.filename,
            content: att.content.toString('base64'), // We convert to base64 because our sender script expects base64
            contentType: att.contentType
          })) : [];

          await sendOutboundEmail({
            from: from,
            to: to,
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html,
            attachments: attachments,
            logCallback: (msg) => console.log(msg)
          });
        }
        
        console.log(`[SMTP RELAY] Successfully relayed email.`);
        callback(null, 'Message accepted and relayed');
      } catch (error) {
        console.error(`[SMTP RELAY ERROR] Failed to relay email:`, error.message);
        // We accept the message anyway so the client doesn't crash, but we log the error
        // If we return an error here, the client's app might throw an exception.
        // It's a design choice. Let's return error to client so they know it failed.
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
