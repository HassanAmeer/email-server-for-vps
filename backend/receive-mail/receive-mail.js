import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import fs from "fs";
import path from "path";
import http from "http";
import nodemailer from "nodemailer";
import { sendOutboundEmail as sendOutboundEmailLive } from "../send-mail-simple/send-mail-from-generated-mail-from-live.js";
import { sendOutboundEmail as sendOutboundEmailLocal } from "../send-mail-simple/send-mail-from-generated-mail-from-local.js";
import { ApiRouter } from "../../apis/api-router.js";

// Load .env file manually if it exists
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const parts = trimmedLine.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, ""); // Remove quotes
        process.env[key] = val;
      }
    }
  });
}

const IS_LIVE = process.env.live !== "false"; // Defaults to true (production) if not set to "false"
const SMTP_PORT = process.env.SMTP_PORT || (IS_LIVE ? 25 : 2525);
const HTTP_PORT = process.env.HTTP_PORT || (IS_LIVE ? 80 : 8081);

// Separate logs for local and live SMTP traffic
const localLogs = [];
const liveLogs = [];

const localReceivingLogs = [];
const localSendingLogs = [];
const liveReceivingLogs = [];
const liveSendingLogs = [];

function addLocalLog(message) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${message}`;
  console.log(`[LOCAL RECEIVING] ${formatted}`);
  localReceivingLogs.push(formatted);
  if (localReceivingLogs.length > 200) localReceivingLogs.shift();
  localLogs.push(formatted);
  if (localLogs.length > 200) localLogs.shift();
}

function addLiveLog(message) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${message}`;
  console.log(`[LIVE RECEIVING] ${formatted}`);
  liveReceivingLogs.push(formatted);
  if (liveReceivingLogs.length > 200) liveReceivingLogs.shift();
  liveLogs.push(formatted);
  if (liveLogs.length > 200) liveLogs.shift();
}

function addLocalSendingLog(message) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${message}`;
  console.log(`[LOCAL SENDING] ${formatted}`);
  localSendingLogs.push(formatted);
  if (localSendingLogs.length > 200) localSendingLogs.shift();
}

function addLiveSendingLog(message) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${message}`;
  console.log(`[LIVE SENDING] ${formatted}`);
  liveSendingLogs.push(formatted);
  if (liveSendingLogs.length > 200) liveSendingLogs.shift();
}

// Folders for local and live emails
const localMailDir = path.join(process.cwd(), "backend", "storage", "local");
const liveMailDir = path.join(process.cwd(), "backend", "storage", "live");
const attachmentsDir = path.join(process.cwd(), "backend", "storage", "media");
[localMailDir, liveMailDir, attachmentsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 1. SMTP Server Setup
// ==========================================
const smtpServer = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onConnect(session, callback) {
    const ip = session.remoteAddress;
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    session.isLocalConnection = isLocal;

    if (isLocal) {
      addLocalLog(`🔌 Connection opened from local IP: ${ip}`);
    } else {
      addLiveLog(`🔌 Connection opened from public IP: ${ip}`);
    }
    return callback();
  },
  onMailFrom(address, session, callback) {
    if (session.isLocalConnection) {
      addLocalLog(`✉️ MAIL FROM (Sender): ${address.address}`);
    } else {
      addLiveLog(`✉️ MAIL FROM (Sender): ${address.address}`);
    }
    return callback();
  },
  onRcptTo(address, session, callback) {
    if (session.isLocalConnection) {
      addLocalLog(`➡️ RCPT TO (Recipient): ${address.address}`);
    } else {
      addLiveLog(`➡️ RCPT TO (Recipient): ${address.address}`);
    }
    return callback();
  },
  onData(stream, session, callback) {
    const isLocal = session.isLocalConnection;
    if (isLocal) {
      addLocalLog("⏳ Receiving email stream data...");
    } else {
      addLiveLog("⏳ Receiving email stream data...");
    }

    simpleParser(stream, {}, (err, parsed) => {
      if (err) {
        if (isLocal) addLocalLog(`❌ ERROR parsing local mail: ${err.message}`);
        else addLiveLog(`❌ ERROR parsing live mail: ${err.message}`);
        return callback(err);
      }

      const subject = parsed.subject || "(No Subject)";
      if (isLocal) addLocalLog(`⏳ Local Email Parsed. Subject: "${subject}"`);
      else addLiveLog(`⏳ Live Email Parsed. Subject: "${subject}"`);

      const safeSubject = subject
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fileName = `${Date.now()}-${safeSubject}.json`;

      const mailData = {
        id: Date.now().toString(),
        from: parsed.from?.text || "Unknown Sender",
        to: parsed.to?.text || "Unknown Recipient",
        subject: subject,
        text: parsed.text || "",
        html: parsed.html || "",
        date: parsed.date || new Date(),
        senderIp: session.remoteAddress,
        headers: Object.fromEntries(parsed.headers),
        attachments: parsed.attachments?.map(att => {
          // Generate a safe filename
          const safeFilename = (att.filename || "unnamed").replace(/[^a-zA-Z0-9.-]/g, "_");
          const savedFileName = `${Date.now()}-${safeFilename}`;
          const filePath = path.join(attachmentsDir, savedFileName);
          
          // Save the attachment buffer to disk
          if (att.content) {
            fs.writeFileSync(filePath, att.content);
          }

          return {
            filename: att.filename || "unnamed",
            contentType: att.contentType,
            size: att.size,
            url: `/api/attachments/${savedFileName}`
          };
        }) || []
      };

      const targetDir = isLocal ? localMailDir : liveMailDir;
      fs.writeFileSync(
        path.join(targetDir, fileName),
        JSON.stringify(mailData, null, 2),
        "utf-8"
      );

      if (isLocal) {
        addLocalLog(`💾 Email saved to: backend/storage/local/${fileName}`);
        addLocalLog(`✅ Email Transaction Complete! Subject: "${subject}"`);
        addLocalLog("__________________________________________________");
      } else {
        addLiveLog(`💾 Email saved to: backend/storage/live/${fileName}`);
        addLiveLog(`✅ Email Transaction Complete! Subject: "${subject}"`);
        addLocalLog("__________________________________________________");
      }

      return callback();
    });
  }
});

// ==========================================
// 2. HTTP Server Setup
// ==========================================
const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Intercept route status check (Can disable specific paths dynamically)
  if (req.url.startsWith("/api/") && !ApiRouter.isApiEnabled(req.url, req.method)) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Service Unavailable: This API endpoint has been disabled by the administrator" }));
    return;
  }

  const cleanUrl = req.url.split("?")[0];

  // Intercept api-router temporary mailbox endpoints
  if (cleanUrl === "/api/mailbox/generate" && req.method === "GET") {
    return ApiRouter.generateMailbox(req, res);
  }
  
  if (cleanUrl.startsWith("/api/mailbox/") && req.method === "GET") {
    const parts = cleanUrl.split("/");
    const email = parts[3];
    const isOtps = parts[4] === "otps";
    if (isOtps) {
      return ApiRouter.getOtps(req, res, email);
    } else {
      return ApiRouter.getMailbox(req, res, email);
    }
  }

  if (cleanUrl.startsWith("/api/mailbox/") && req.method === "DELETE") {
    const parts = cleanUrl.split("/");
    const email = parts[3];
    const mailId = parts[4];
    if (mailId) {
      return ApiRouter.deleteMail(req, res, email, mailId);
    } else {
      return ApiRouter.deleteMailbox(req, res, email);
    }
  }

  // Intercept admin endpoints
  if (cleanUrl === "/api/admin/login" && req.method === "POST") {
    return ApiRouter.adminLogin(req, res);
  }

  if (cleanUrl === "/api/admin/stats" && req.method === "GET") {
    return ApiRouter.getStats(req, res);
  }

  if (cleanUrl === "/api/admin/api-settings" && req.method === "GET") {
    return ApiRouter.getApiSettings(req, res);
  }

  if (cleanUrl === "/api/admin/api-settings/toggle" && req.method === "POST") {
    return ApiRouter.toggleApiSetting(req, res);
  }

  if (cleanUrl === "/api/admin/credentials" && req.method === "GET") {
    return ApiRouter.getCredentials(req, res);
  }

  if (cleanUrl === "/api/admin/credentials" && req.method === "POST") {
    return ApiRouter.addCredential(req, res);
  }

  if (cleanUrl.startsWith("/api/admin/credentials/") && req.method === "DELETE") {
    const username = decodeURIComponent(cleanUrl.split("/api/admin/credentials/")[1]);
    return ApiRouter.deleteCredential(req, res, username);
  }

  // API: Get all emails (combined local and live)
  if (req.url === "/api/mails" && req.method === "GET") {
    try {
      const localFiles = fs.readdirSync(localMailDir)
        .filter(file => file.endsWith(".json"));
      const liveFiles = fs.readdirSync(liveMailDir)
        .filter(file => file.endsWith(".json"));

      const localEmails = localFiles.map(file => {
        const fileContent = fs.readFileSync(path.join(localMailDir, file), "utf-8");
        const parsed = JSON.parse(fileContent);
        parsed.fileName = file;
        parsed.type = "local";
        return parsed;
      });

      const liveEmails = liveFiles.map(file => {
        const fileContent = fs.readFileSync(path.join(liveMailDir, file), "utf-8");
        const parsed = JSON.parse(fileContent);
        parsed.fileName = file;
        parsed.type = "live";
        return parsed;
      });

      const allEmails = [...localEmails, ...liveEmails]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(allEmails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${error.message}`);
    }
    return;
  }

  // API 1: Get local emails
  if (req.url === "/api/emails/local" && req.method === "GET") {
    try {
      const files = fs.readdirSync(localMailDir)
        .filter(file => file.endsWith(".json"))
        .sort((a, b) => b.localeCompare(a));

      const emails = files.map(file => {
        const fileContent = fs.readFileSync(path.join(localMailDir, file), "utf-8");
        const parsed = JSON.parse(fileContent);
        parsed.fileName = file;
        return parsed;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(emails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${error.message}`);
    }
    return;
  }

  // API 2: Get live emails
  if (req.url === "/api/emails/live" && req.method === "GET") {
    try {
      const files = fs.readdirSync(liveMailDir)
        .filter(file => file.endsWith(".json"))
        .sort((a, b) => b.localeCompare(a));

      const emails = files.map(file => {
        const fileContent = fs.readFileSync(path.join(liveMailDir, file), "utf-8");
        const parsed = JSON.parse(fileContent);
        parsed.fileName = file;
        return parsed;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(emails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${error.message}`);
    }
    return;
  }

  // API 3: Get local logs (Receiving or Sending)
  if (req.url.startsWith("/api/logs/local") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url === "/api/logs/local/receiving") {
      res.end(JSON.stringify(localReceivingLogs));
    } else if (req.url === "/api/logs/local/sending") {
      res.end(JSON.stringify(localSendingLogs));
    } else {
      res.end(JSON.stringify(localLogs));
    }
    return;
  }

  // API 4: Get live logs (Receiving or Sending)
  if (req.url.startsWith("/api/logs/live") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url === "/api/logs/live/receiving") {
      res.end(JSON.stringify(liveReceivingLogs));
    } else if (req.url === "/api/logs/live/sending") {
      res.end(JSON.stringify(liveSendingLogs));
    } else {
      res.end(JSON.stringify(liveLogs));
    }
    return;
  }

  // API 5: Trigger Local/Live Nodemailer Send
  if ((req.url === "/api/test-send" || req.url === "/api/test-send/local" || req.url === "/api/test-send/live") && req.method === "POST") {
    const isLive = req.url === "/api/test-send/live";
    const logSender = isLive ? addLiveSendingLog : addLocalSendingLog;
    const logReceiver = isLive ? addLiveLog : addLocalLog;

    logSender(`Triggering ${isLive ? "live" : "local"} Nodemailer test send...`);

    const transporter = nodemailer.createTransport({
      host: "127.0.0.1",
      port: SMTP_PORT,
      secure: false,
      tls: { rejectUnauthorized: false }
    });

    const testOptions = {
      from: `"${isLive ? "Live" : "Local"} Tester" <tester@${isLive ? "livedomain.com" : "localdomain.com"}>`,
      to: `${isLive ? "live" : "local"}-test@tempemail.com`,
      subject: `${isLive ? "Live" : "Local"} Test Mail — ${new Date().toLocaleTimeString()}`,
      text: `${isLive ? "Live" : "Local"} testing is working! This mail went to ${isLive ? "live" : "local"} directory.`,
      html: `<p>${isLive ? "Live" : "Local"} testing is <strong>working!</strong> This mail went to ${isLive ? "live" : "local"} directory.</p>`
    };

    transporter.sendMail(testOptions, (error, info) => {
      if (error) {
        logSender(`❌ Test Send Error: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error.message }));
      } else {
        logSender(`✅ Test Send Success: ${info.response}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, response: info.response }));
      }
    });
    return;
  }

  // API 8: Send Custom Outbound Email (Live)
  if (req.url === "/api/send-email/live" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { from, to, subject, text, html, attachments } = data;
        
        addLiveSendingLog(`Initiating custom outbound email from ${from} to ${to}`);
        
        await sendOutboundEmailLive({ 
          from, 
          to, 
          subject, 
          text, 
          html, 
          attachments,
          logCallback: (msg) => addLiveSendingLog(msg) 
        });
        
        addLiveSendingLog(`✅ Successfully sent custom email from ${from} to ${to}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        addLiveSendingLog(`❌ Failed to send custom email: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // API 9: Send Custom Outbound Email (Local)
  if (req.url === "/api/send-email/local" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { from, to, subject, text, html, attachments } = data;
        
        addLocalSendingLog(`Initiating custom outbound email from ${from} to ${to}`);
        
        await sendOutboundEmailLocal({ 
          from, 
          to, 
          subject, 
          text, 
          html, 
          attachments,
          logCallback: (msg) => addLocalSendingLog(msg) 
        });
        
        addLocalSendingLog(`✅ Successfully sent custom email from ${from} to ${to}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        addLocalSendingLog(`❌ Failed to send custom email: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // API 9: Serve Attachment Files
  if (req.url.startsWith("/api/attachments/") && req.method === "GET") {
    const filename = req.url.split("/api/attachments/")[1];
    if (!filename) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing filename" }));
    }
    const filePath = path.join(attachmentsDir, decodeURIComponent(filename));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Attachment not found" }));
    }
    
    // Serve the file
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // API 6: Delete local email
  if (req.url.startsWith("/api/emails/delete/local/") && req.method === "POST") {
    const parts = req.url.split("/");
    const fileName = parts[parts.length - 1];
    const filePath = path.join(localMailDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      addLocalLog(`Deleted local email file: ${fileName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Email not found");
    }
    return;
  }

  // API 7: Delete live email
  if (req.url.startsWith("/api/emails/delete/live/") && req.method === "POST") {
    const parts = req.url.split("/");
    const fileName = parts[parts.length - 1];
    const filePath = path.join(liveMailDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      addLiveLog(`Deleted live email file: ${fileName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Email not found");
    }
    return;
  }

  // Fallback: Static file serving (serves compiled static website)
  let reqPath = req.url.split("?")[0];

  // Redirect to trailing slash for proper directory asset loading of static routes
  if (reqPath === "/admin" || reqPath === "/local" || reqPath === "/live") {
    res.writeHead(301, { "Location": reqPath + "/" });
    res.end();
    return;
  }

  // Handle routing for static compiled pages
  if (reqPath.startsWith("/local/")) {
    reqPath = "/local/index.html";
  } else if (reqPath.startsWith("/live/")) {
    reqPath = "/live/index.html";
  } else if (reqPath.startsWith("/admin/")) {
    reqPath = "/admin/index.html";
  } else if (reqPath === "/") {
    reqPath = "/index.html";
  }

  const publicPath = path.join(process.cwd(), "out", reqPath);

  if (fs.existsSync(publicPath) && fs.lstatSync(publicPath).isFile()) {
    const ext = path.extname(publicPath);
    let contentType = "text/html";
    if (ext === ".css") contentType = "text/css";
    else if (ext === ".js") contentType = "application/javascript";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg") contentType = "image/jpeg";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".json") contentType = "application/json";
    else if (ext === ".wav") contentType = "audio/wav";
    else if (ext === ".ico") contentType = "image/x-icon";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(publicPath).pipe(res);
  } else {
    // SPA fallback
    const indexFallback = path.join(process.cwd(), "out", "index.html");
    if (fs.existsSync(indexFallback)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexFallback).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404: Web assets missing. Please run 'npm run build' first.");
    }
  }
});

// Server Error Handlers
smtpServer.on("error", (err) => {
  addLocalLog(`🚨 SMTP Server Error: ${err.message}`);
  addLiveLog(`🚨 SMTP Server Error: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }
});

httpServer.on("error", (err) => {
  addLocalLog(`🚨 HTTP Server Error: ${err.message}`);
  addLiveLog(`🚨 HTTP Server Error: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }
});

// Process-level uncaught handlers to prevent VPS process crashes
process.on("uncaughtException", (err) => {
  addLocalLog(`🔥 Uncaught Exception: ${err.message}`);
  addLiveLog(`🔥 Uncaught Exception: ${err.message}`);
  console.error("Critical Exception Stack:", err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  const msg = reason instanceof Error ? reason.message : reason;
  addLocalLog(`🔥 Unhandled Promise Rejection: ${msg}`);
  addLiveLog(`🔥 Unhandled Promise Rejection: ${msg}`);
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start Servers
smtpServer.listen(SMTP_PORT, () => {
  const envText = IS_LIVE ? "LIVE Environment" : "LOCAL Environment";
  addLocalLog(`SMTP Server listening on Port ${SMTP_PORT} for incoming emails (${envText}).`);
  addLiveLog(`SMTP Server listening on Port ${SMTP_PORT} for incoming emails (${envText}).`);
  console.log(`==========================================`);
  console.log(`🚀 [RECEIVING SERVER] Currently used port for Receiving: ${SMTP_PORT} (${envText})`);
  console.log(`==========================================`);
});

httpServer.listen(HTTP_PORT, () => {
  const envText = IS_LIVE ? "LIVE Environment" : "LOCAL Environment";
  addLocalLog(`Web Console listening on http://localhost:${HTTP_PORT} (${envText})`);
  addLiveLog(`Web Console listening on http://localhost:${HTTP_PORT} (${envText})`);
  console.log(`==========================================`);
  console.log(`🌐 [WEB UI] Currently used port for Web Dashboard: ${HTTP_PORT} (${envText})`);
  console.log(`==========================================`);
});
