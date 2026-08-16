import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import nodemailer from "nodemailer";
import { sendOutboundEmail as sendOutboundEmailLive } from "../send-mail-simple/send-mail-from-generated-mail-from-live.js";
import { sendOutboundEmail as sendOutboundEmailLocal } from "../send-mail-simple/send-mail-from-generated-mail-from-local.js";
import { ApiRouter } from "../../apis/api-router.js";
import { logReceivedEmail, getProjectByEmail, logSystemEvent, runDataRetentionCleanupJob, validateRecipientCatchAll, getProjectAllowedFiles, getActiveDomainsWithPlan, getSetting, setSetting, getAllFlags } from "../database/db.js";

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

function extractEmail(str) {
  if (!str) return "";
  const match = str.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase().trim() : str.toLowerCase().trim();
}

// Folders for local, live, and IMAP Maildir emails
const localMailDir = path.join(process.cwd(), "backend", "storage", "local");
const liveMailDir = path.join(process.cwd(), "backend", "storage", "live");
const attachmentsDir = path.join(process.cwd(), "backend", "storage", "media-mails");
const maildirBase = path.join(process.cwd(), "backend", "storage", "maildir");

[localMailDir, liveMailDir, attachmentsDir, maildirBase].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Save raw RFC822 .eml to standard Maildir folder for Dovecot IMAP
 * Uses standard Maildir layout (tmp -> new) and hardlinks for Master view (0 extra bytes)
 */
function saveToMaildir(rawBuffer, recipientEmail) {
  try {
    const cleanEmail = extractEmail(recipientEmail);
    if (!cleanEmail || !cleanEmail.includes("@")) return null;

    const parts = cleanEmail.split("@");
    const user = parts[0];
    const domain = parts[1];
    if (!user || !domain) return null;

    // Standard Maildir paths for user: <domain>/<user>/{tmp, new, cur}
    const userMaildir = path.join(maildirBase, domain, user);
    const userTmpDir = path.join(userMaildir, "tmp");
    const userNewDir = path.join(userMaildir, "new");
    const userCurDir = path.join(userMaildir, "cur");

    [userTmpDir, userNewDir, userCurDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const now = Date.now();
    const uniqueId = `${now}.${process.pid}_${Math.random().toString(36).substring(2, 8)}.${domain}`;
    const fileName = `${uniqueId}.eml`;

    const tmpFilePath = path.join(userTmpDir, fileName);
    const newFilePath = path.join(userNewDir, fileName);

    // Atomically write raw .eml buffer to Maildir
    fs.writeFileSync(tmpFilePath, rawBuffer);
    fs.renameSync(tmpFilePath, newFilePath);

    // Hardlink to _all_mails_ for Master Admin view with 0 duplicate storage bytes
    try {
      const allMaildir = path.join(maildirBase, "_all_mails_");
      const allNewDir = path.join(allMaildir, "new");
      const allCurDir = path.join(allMaildir, "cur");
      const allTmpDir = path.join(allMaildir, "tmp");
      [allTmpDir, allNewDir, allCurDir].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      });

      const allNewFilePath = path.join(allNewDir, `${cleanEmail}_${fileName}`);
      if (fs.existsSync(newFilePath) && !fs.existsSync(allNewFilePath)) {
        fs.linkSync(newFilePath, allNewFilePath);
      }
    } catch (linkErr) {
      // Ignored if linkSync fails (e.g. cross-filesystem)
    }

    // Hardlink to domain's primary/admin mailbox so IMAP/POP3 catch-all works seamlessly
    try {
      const primaryPrefix = "admin";
      if (user.toLowerCase() !== primaryPrefix) {
        const domainAdminDir = path.join(maildirBase, domain, primaryPrefix);
        const adminNewDir = path.join(domainAdminDir, "new");
        const adminCurDir = path.join(domainAdminDir, "cur");
        const adminTmpDir = path.join(domainAdminDir, "tmp");
        [adminTmpDir, adminNewDir, adminCurDir].forEach(d => {
          if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        });

        const domainAdminFilePath = path.join(adminNewDir, fileName);
        if (fs.existsSync(newFilePath) && !fs.existsSync(domainAdminFilePath)) {
          fs.linkSync(newFilePath, domainAdminFilePath);
        }
      }
    } catch (adminLinkErr) {
      // Ignored if link fails
    }

    return newFilePath;
  } catch (err) {
    console.error("Error saving to Maildir:", err);
    return null;
  }
}

// ==========================================
// SMTP IP Rate Limiter (in-memory, no DB)
// Prevents spam bots from flooding logs
// ==========================================
const ipRateLimiter = new Map(); // ip -> { count, resetAt }
const IP_RATE_LIMIT = 15;         // max RCPT TO per window
const IP_RATE_WINDOW_MS = 60000;  // 60 second window

function checkIpRateLimit(ip) {
  const now = Date.now();
  let entry = ipRateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + IP_RATE_WINDOW_MS };
    ipRateLimiter.set(ip, entry);
  }
  entry.count++;
  return entry.count <= IP_RATE_LIMIT;
}

// Periodically clean up old IP entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRateLimiter.entries()) {
    if (now > entry.resetAt) ipRateLimiter.delete(ip);
  }
}, 300000);

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

    // Only log connections in-memory (not to DB) to avoid log flood from spam bots
    const msg = `🔌 Connection from ${isLocal ? 'local' : 'public'} IP: ${ip}`;
    if (isLocal) addLocalLog(msg); else addLiveLog(msg);

    return callback();
  },
  onMailFrom(address, session, callback) {
    // Only in-memory log — do NOT write to DB for every MAIL FROM (spam bots hit this constantly)
    const msg = `✉️ MAIL FROM: ${address.address}`;
    if (session.isLocalConnection) addLocalLog(msg); else addLiveLog(msg);
    return callback();
  },
  onRcptTo(address, session, callback) {
    const ip = session.remoteAddress;

    // Rate limit: drop connections from IPs that send too many RCPT TO
    if (!session.isLocalConnection && !checkIpRateLimit(ip)) {
      return callback(new Error('421 Too many connections from your IP. Please try again later.'));
    }

    // Only in-memory log for RCPT TO — written to DB only if rcpt_logging flag is ON
    const msg = `➡️ RCPT TO: ${address.address}`;
    if (session.isLocalConnection) addLocalLog(msg); else addLiveLog(msg);

    // Validate recipient (Catch-All check)
    const isValid = validateRecipientCatchAll(address.address);
    if (!isValid) {
      // Always log rejections to DB (meaningful event)
      logSystemEvent({ log_type: 'RECEIVE', status: 'WARNING', message: 'Rejected Recipient (Catch-All OFF)', details: { recipient: address.address, ip } });
      return callback(new Error("550 Requested action not taken: mailbox unavailable"));
    }

    // Log to DB only if rcpt_logging is enabled (default: OFF)
    if (getSetting('rcpt_logging') === '1') {
      logSystemEvent({ log_type: 'RECEIVE', status: 'INFO', message: 'RCPT TO received', details: { recipient: address.address, ip } });
    }

    return callback();
  },
  onData(stream, session, callback) {
    const isLocal = session.isLocalConnection;
    const msg = "⏳ Receiving email stream data...";
    if (isLocal) addLocalLog(msg); else addLiveLog(msg);
    logSystemEvent({ log_type: 'RECEIVE', status: 'INFO', message: 'Receiving Data Stream', details: null });

    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("error", err => {
      const errMsg = `❌ ERROR reading stream: ${err.message}`;
      if (isLocal) addLocalLog(errMsg); else addLiveLog(errMsg);
      logSystemEvent({ log_type: 'RECEIVE', status: 'ERROR', message: 'Stream Reading Failed', details: { error: err.message } });
      return callback(err);
    });
    stream.on("end", () => {
      const rawBuffer = Buffer.concat(chunks);

      simpleParser(rawBuffer, {}, (err, parsed) => {
        if (err) {
          const errMsg = `❌ ERROR parsing mail: ${err.message}`;
          if (isLocal) addLocalLog(errMsg); else addLiveLog(errMsg);
          logSystemEvent({ log_type: 'RECEIVE', status: 'ERROR', message: 'Stream Parsing Failed', details: { error: err.message } });
          return callback(err);
        }

        const subject = parsed.subject || "(No Subject)";
        const parsedMsg = `⏳ Email Parsed. Subject: "${subject}"`;
        if (isLocal) addLocalLog(parsedMsg); else addLiveLog(parsedMsg);
        logSystemEvent({ log_type: 'RECEIVE', status: 'INFO', message: 'Email Parsed Successfully', details: { subject } });

      const safeSubject = subject
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fileName = `${Date.now()}-${safeSubject}.json`;

      const targetEmailRaw = parsed.to?.text || "Unknown Recipient";
      const targetEmailClean = extractEmail(targetEmailRaw);
      const project = getProjectByEmail(targetEmailClean);
      
      let allowedList = null;
      if (project) {
        const domainParts = targetEmailClean.split("@");
        const targetDomain = domainParts.length === 2 ? domainParts[1] : "";
        const activeDomains = getActiveDomainsWithPlan();
        const domInfo = activeDomains.find(d => d.domain === targetDomain);
        const plan = (domInfo && domInfo.plan === "premium") ? "pro" : "free";
        
        const allowedFilesObj = getProjectAllowedFiles(project.id);
        allowedList = allowedFilesObj[plan] || [];
      }

      const mailData = {
        id: Date.now().toString(),
        from: parsed.from?.text || "Unknown Sender",
        to: targetEmailRaw,
        subject: subject,
        text: parsed.text || "",
        html: parsed.html || "",
        date: parsed.date || new Date(),
        senderIp: session.remoteAddress,
        headers: Object.fromEntries(parsed.headers),
        attachments: (parsed.attachments || []).map(att => {
          if (!att.filename) return null;
          
          if (allowedList) {
             const ext = att.filename.split('.').pop().toLowerCase();
             if (!allowedList.includes(ext)) {
                 const dropMsg = `❌ Attachment Dropped: ${att.filename} (Extension not allowed for this project)`;
                 if (isLocal) addLocalLog(dropMsg); else addLiveLog(dropMsg);
                 return null;
             }
          }

          // Generate a safe filename
          const safeFilename = att.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const savedFileName = `${Date.now()}-${safeFilename}`;
          const filePath = path.join(attachmentsDir, savedFileName);

          let contentType = att.contentType || 'application/octet-stream';

          // Save the attachment buffer to disk and detect type
          if (att.content) {
            if (att.content.length > 4) {
              if (att.content[0] === 0x89 && att.content[1] === 0x50 && att.content[2] === 0x4E && att.content[3] === 0x47) contentType = 'image/png';
              else if (att.content[0] === 0xFF && att.content[1] === 0xD8 && att.content[2] === 0xFF) contentType = 'image/jpeg';
              else if (att.content[0] === 0x47 && att.content[1] === 0x49 && att.content[2] === 0x46) contentType = 'image/gif';
              else if (att.content[0] === 0x52 && att.content[1] === 0x49 && att.content[2] === 0x46 && att.content[3] === 0x46) contentType = 'image/webp';
              else if (att.content[0] === 0x25 && att.content[1] === 0x50 && att.content[2] === 0x44 && att.content[3] === 0x46) contentType = 'application/pdf';
              else if (att.content[0] === 0x50 && att.content[1] === 0x4B && att.content[2] === 0x03 && att.content[3] === 0x04) contentType = 'application/zip';
            }
            fs.writeFileSync(filePath, att.content);
          }

          return {
            filename: att.filename,
            contentType: contentType,
            size: att.size,
            url: `/api/attachments/${savedFileName}`
          };
        }).filter(Boolean)
      };

      const targetDir = isLocal ? localMailDir : liveMailDir;
      fs.writeFileSync(
        path.join(targetDir, fileName),
        JSON.stringify(mailData, null, 2),
        "utf-8"
      );

      // Save raw .eml to standard Maildir for Dovecot IMAP (Zero Duplication)
      const maildirSavedPath = saveToMaildir(rawBuffer, targetEmailClean);
      if (maildirSavedPath) {
        const imapLogMsg = `📥 IMAP Maildir synced: ${targetEmailClean}`;
        if (isLocal) addLocalLog(imapLogMsg); else addLiveLog(imapLogMsg);
      }

      // Log to SQLite Database
      const projectId = project ? project.id : null;
      const totalAttachmentSize = mailData.attachments.reduce((sum, att) => sum + (att.size || 0), 0) || 0;
      logReceivedEmail(mailData.to, mailData.from, mailData.subject, mailData.attachments.length > 0, projectId, totalAttachmentSize, fileName);

      logSystemEvent({ log_type: 'RECEIVE', status: 'INFO', message: 'Email Saved to Disk', details: { file: fileName, projectId }, project_id: projectId });

      // Trigger Webhook if configured
      if (project && project.webhook_url) {
        try {
          fetch(project.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: "new_email", project_id: project.id, data: mailData })
          }).then(res => {
            const webhookMsg = `🚀 Webhook delivered to ${project.webhook_url} with status ${res.status}`;
            if (isLocal) addLocalLog(webhookMsg); else addLiveLog(webhookMsg);
            logSystemEvent({ log_type: 'RECEIVE', status: res.ok ? 'SUCCESS' : 'ERROR', message: 'Webhook Triggered', details: { url: project.webhook_url, status: res.status }, project_id: projectId });
          }).catch(err => {
            console.error("Webhook trigger failed:", err.message);
            logSystemEvent({ log_type: 'RECEIVE', status: 'ERROR', message: 'Webhook Failed', details: { url: project.webhook_url, error: err.message }, project_id: projectId });
          });
        } catch (e) { }
      }

      const finishMsg = `✅ Email Transaction Complete! Subject: "${subject}"`;
      if (isLocal) {
        addLocalLog(`💾 Email saved to: backend/storage/local/${fileName}`);
        addLocalLog(finishMsg);
        addLocalLog("__________________________________________________");
      } else {
        addLiveLog(`💾 Email saved to: backend/storage/live/${fileName}`);
        addLiveLog(finishMsg);
        addLiveLog("__________________________________________________");
      }
      logSystemEvent({ log_type: 'RECEIVE', status: 'SUCCESS', message: 'Transaction Complete', details: { subject }, project_id: projectId });

      return callback();
    });
    });
  }
});

// ==========================================
// 2. HTTP Server Setup
// ==========================================
const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

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
  if (cleanUrl === "/api/domains" && req.method === "GET") {
    return ApiRouter.getDomains(req, res);
  }

  if (cleanUrl === "/api/mailbox/generate" && req.method === "GET") {
    return ApiRouter.generateMailbox(req, res);
  }

  if (cleanUrl === "/api/mailbox/custom" && req.method === "GET") {
    return ApiRouter.customGenerateMailbox(req, res);
  }

  if (cleanUrl === "/api/project/forbidden-ids") {
    return ApiRouter.handleForbiddenIds(req, res);
  }

  if (cleanUrl === "/api/project/retention") {
    return ApiRouter.handleRetentionApi(req, res);
  }

  if (cleanUrl === "/api/project/allowed-files") {
    return ApiRouter.handleAllowedFilesApi(req, res);
  }

  // Handle IMAP Master Mailbox Web UI APIs
  if (cleanUrl.startsWith("/api/imap-mailbox")) {
    return ApiRouter.handleImapMailboxApi(req, res);
  }

  // Handle Permanent Mailbox Web UI APIs before they get caught by temporary mailbox regex
  if (cleanUrl.startsWith("/api/mailbox/inbox") || 
      cleanUrl.startsWith("/api/mailbox/login") || 
      cleanUrl.startsWith("/api/mailbox/send") || 
      cleanUrl.startsWith("/api/mailbox/media") ||
      cleanUrl === "/api/mailbox/count") {
    return ApiRouter.handleMailboxApi(req, res);
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

  if (cleanUrl.startsWith("/api/admin/projects")) {
    return ApiRouter.handleProjectsApi(req, res);
  }

  if (cleanUrl.startsWith("/api/admin/mailbox-users")) {
    return ApiRouter.handleAdminMailboxUsersApi(req, res);
  }

  if (cleanUrl.startsWith("/api/mailbox")) {
    return ApiRouter.handleMailboxApi(req, res);
  }

  if (cleanUrl.startsWith("/api/admin/domains")) {
    return ApiRouter.handleAttachedDomainsApi(req, res);
  }

  if (cleanUrl === "/api/admin/stats" && req.method === "GET") {
    return ApiRouter.getStats(req, res);
  }

  if (cleanUrl === "/api/admin/stats/traffic" && req.method === "GET") {
    return ApiRouter.handleTrafficStatsApi(req, res);
  }

  if (cleanUrl.startsWith("/api/admin/seed")) {
    return ApiRouter.handleSeedDataApi(req, res);
  }

  if (cleanUrl.startsWith("/api/admin/dblogs")) {
    const parts = cleanUrl.replace(/\/+$/, "").split("/");
    const logType = parts.length > 0 ? parts[parts.length - 1] : "all";
    return ApiRouter.getDbLogs(req, res, logType || "all");
  }

  if (cleanUrl === "/api/admin/api-settings" && req.method === "GET") {
    return ApiRouter.getApiSettings(req, res);
  }

  if (cleanUrl === "/api/admin/api-settings/toggle" && req.method === "POST") {
    return ApiRouter.toggleApiSetting(req, res);
  }

  if (cleanUrl === "/api/admin/api-settings/reset-hits" && req.method === "POST") {
    return ApiRouter.resetApiSettingsHits(req, res);
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

  if (cleanUrl === "/api/admin/serverinfo" && req.method === "GET") {
    return ApiRouter.getDkimKey(req, res);
  }

  if (cleanUrl === "/api/admin/dkim/generate" && req.method === "POST") {
    return ApiRouter.generateDkimKey(req, res);
  }

  // SMTP Server Flags: GET all flags
  if (cleanUrl === "/api/admin/smtp-flags" && req.method === "GET") {
    const authHeader = req.headers["authorization"] || "";
    const adminToken = Buffer.from("admin:1234").toString("base64");
    if (authHeader !== `Bearer ${adminToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }
    const flags = getAllFlags();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true, flags }));
  }

  // SMTP Server Flags: POST to toggle/set a flag
  if (cleanUrl === "/api/admin/smtp-flags" && req.method === "POST") {
    const authHeader = req.headers["authorization"] || "";
    const adminToken = Buffer.from("admin:1234").toString("base64");
    if (authHeader !== `Bearer ${adminToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { flag, value } = JSON.parse(body || "{}");
        if (!flag) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "flag is required" }));
        }
        const newVal = (value === true || value === "1" || value === 1) ? "1" : "0";
        setSetting(flag, newVal);
        const updated = getAllFlags();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, flags: updated }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  // Helper to safely read recent JSON email files
  const readRecentEmails = (dir, limit = 50, emailFilter = "") => {
    if (!fs.existsSync(dir)) return [];
    const allFiles = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    allFiles.sort((a, b) => b.localeCompare(a));
    const sliceCount = limit > 0 ? limit : 50;
    const selectedFiles = allFiles.slice(0, Math.min(allFiles.length, 200));
    const emails = [];
    for (const file of selectedFiles) {
      try {
        const fileContent = fs.readFileSync(path.join(dir, file), "utf-8");
        const parsed = JSON.parse(fileContent);
        parsed.fileName = file;
        if (emailFilter) {
          const toStr = typeof parsed.to === "string" ? parsed.to.toLowerCase() : JSON.stringify(parsed.to || "").toLowerCase();
          if (toStr.includes(emailFilter)) {
            emails.push(parsed);
          }
        } else {
          emails.push(parsed);
        }
        if (emails.length >= sliceCount) break;
      } catch (e) {}
    }
    return emails;
  };

  // API: Get all emails (combined local and live)
  if (cleanUrl === "/api/mails" && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const email = (url.searchParams.get("email") || "").toLowerCase().trim();

      const localEmails = readRecentEmails(localMailDir, limit, email).map(m => ({ ...m, type: "local" }));
      const liveEmails = readRecentEmails(liveMailDir, limit, email).map(m => ({ ...m, type: "live" }));

      const allEmails = [...localEmails, ...liveEmails]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, limit);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(allEmails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${error.message}`);
    }
    return;
  }

  // API 1: Get local emails
  if (cleanUrl === "/api/emails/local" && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const email = (url.searchParams.get("email") || "").toLowerCase().trim();
      const emails = readRecentEmails(localMailDir, limit, email);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(emails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${error.message}`);
    }
    return;
  }

  // API 2: Get live emails
  if (cleanUrl === "/api/emails/live" && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const email = (url.searchParams.get("email") || "").toLowerCase().trim();
      const emails = readRecentEmails(liveMailDir, limit, email);

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
    res.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable"
    });
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
  if (reqPath === "/admin" || reqPath === "/local" || reqPath === "/live" || reqPath === "/doc" || reqPath === "/mailbox") {
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
  } else if (reqPath.startsWith("/doc/")) {
    reqPath = "/doc/index.html";
  } else if (reqPath.startsWith("/mailbox/")) {
    if (reqPath.startsWith("/mailbox/inbox")) {
      reqPath = "/mailbox/inbox/index.html";
    } else {
      reqPath = "/mailbox/index.html";
    }
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

/**
 * Automatically checks and starts Dovecot IMAP daemon on server start
 */
function autoStartDovecot() {
  exec("which dovecot", (err, stdout) => {
    if (err || !stdout || !stdout.trim()) {
      const msg = "ℹ️ Dovecot IMAP binary not detected. To install & enable IMAP on your VPS, run: sudo bash backend/imap-setup/setup-dovecot.sh";
      addLocalLog(msg);
      addLiveLog(msg);
      return;
    }

    exec("systemctl is-active dovecot || pgrep dovecot", (errActive, stdoutActive) => {
      const isRunning = stdoutActive && (stdoutActive.includes("active") || stdoutActive.trim().length > 0);
      if (isRunning) {
        const msg = "📬 IMAP Server (Dovecot) is ACTIVE and listening on ports 143 (Plain) & 993 (SSL).";
        addLocalLog(msg);
        addLiveLog(msg);
        console.log(`📬 [IMAP SERVER] Dovecot is active on ports 143 / 993`);
      } else {
        exec("sudo systemctl start dovecot || systemctl start dovecot || service dovecot start || dovecot", (errStart) => {
          if (!errStart) {
            const msg = "🚀 Dovecot IMAP service auto-started successfully on ports 143 / 993.";
            addLocalLog(msg);
            addLiveLog(msg);
            console.log(`🚀 [IMAP SERVER] Dovecot auto-started successfully`);
          } else {
            const msg = `⚠️ Could not auto-start Dovecot without sudo. Run: sudo systemctl start dovecot`;
            addLocalLog(msg);
            addLiveLog(msg);
          }
        });
      }
    });
  });
}

// Auto-start Dovecot IMAP daemon alongside mail server
setTimeout(autoStartDovecot, 1500);

// Start Background Data Retention Cleanup Job (Runs every 24 hours)
setInterval(() => {
  runDataRetentionCleanupJob();
}, 24 * 60 * 60 * 1000);
// Also run once on startup
setTimeout(runDataRetentionCleanupJob, 5000);

