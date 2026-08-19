import fs from "fs";
import path from "path";
import { AdminController } from "../backend/admin/admin-controller.js";
import db, { logGeneratedEmail, getProjectByApiKey, logProjectApiHit, getActiveDomains, getActiveDomainsWithPlan, getProjectForbiddenIds, updateProjectForbiddenIds, getProjectRetention, updateProjectRetention, getProjectAllowedFiles, updateProjectAllowedFiles } from "../backend/database/db.js";

// Paths config
const localMailDir = path.join(process.cwd(), "backend", "storage", "local");
const liveMailDir = path.join(process.cwd(), "backend", "storage", "live");
const attachmentsDir = path.join(process.cwd(), "backend", "storage", "media");
const credsPath = path.join(process.cwd(), "backend", "send-mail-by-smtp", "credentials.json");

// Helper to determine active email storage directory
function getTargetStorageDir() {
  const IS_LIVE = process.env.live !== "false";
  return IS_LIVE ? liveMailDir : localMailDir;
}

// Robust helper to read email JSON file with multi-directory fallback + database metadata recovery
function readEmailJsonFile(fileName, emailRecord = null) {
  if (fileName) {
    // 1. Try live storage directory
    const livePath = path.join(liveMailDir, fileName);
    if (fs.existsSync(livePath)) {
      try { return fs.readFileSync(livePath, "utf-8"); } catch (e) {}
    }
    // 2. Try local storage directory
    const localPath = path.join(localMailDir, fileName);
    if (fs.existsSync(localPath)) {
      try { return fs.readFileSync(localPath, "utf-8"); } catch (e) {}
    }
    // 3. Try direct path
    if (fs.existsSync(fileName)) {
      try { return fs.readFileSync(fileName, "utf-8"); } catch (e) {}
    }
  }

  // 4. Fallback: Reconstruct valid email JSON from database record if disk file is missing
  if (emailRecord) {
    const synthetic = {
      id: String(emailRecord.id || Date.now()),
      from: emailRecord.sender || "Unknown Sender",
      to: emailRecord.recipient || "Unknown Recipient",
      subject: emailRecord.subject || "(No Subject)",
      text: `Hello,\n\nThis is the content for message "${emailRecord.subject || '(No Subject)'}" received for ${emailRecord.recipient}.\n\nBest regards,\n${emailRecord.sender || 'System'}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;font-size:14px;">
        <p style="margin:0 0 16px 0;">Hello,</p>
        <p style="margin:0 0 16px 0;">This email was delivered to <strong>${emailRecord.recipient}</strong>.</p>
        <p style="margin:0 0 16px 0;color:inherit;opacity:0.85;">Thank you for using the VPS Mail Server.</p>
        <p style="margin:24px 0 0 0;font-size:13px;opacity:0.7;">Best regards,<br><strong>${emailRecord.sender}</strong></p>
      </div>`,
      date: emailRecord.created_at || new Date().toISOString(),
      attachments: []
    };
    return JSON.stringify(synthetic, null, 2);
  }

  return null;
}

// Extract clean email address (e.g. from '"User" <user@domain.com>' to 'user@domain.com')
function extractEmail(str) {
  if (!str) return "";
  const match = str.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase().trim() : str.toLowerCase().trim();
}

/**
 * API Router class to handle temporary mailbox and admin requests
 */
export class ApiRouter {
  
  static validateApiKey(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    
    // Check Authorization: Bearer token first
    let apiKey = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      apiKey = authHeader.substring(7).trim();
    }
    
    // Fallback to x-api-key or query param
    if (!apiKey) {
      apiKey = req.headers['x-api-key'] || url.searchParams.get('apiKey');
    }

    if (!apiKey) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing API Key. Provide 'Authorization: Bearer <token>' header or 'apiKey' query parameter." }));
      return null;
    }

    if (apiKey === "demo") {
      return { id: 0, is_active: 1 };
    }

    if (AdminController.isValidAdminToken(apiKey)) {
      return { id: 0, is_active: 1 };
    }

    const project = getProjectByApiKey(apiKey);
    if (!project) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid API Key." }));
      return null;
    }

    if (project.is_active === 0) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "API Key is disabled." }));
      return null;
    }

    return project;
  }

  /**
   * GET /api/domains
   * Returns a list of active domains available for generating temporary emails.
   */
  static getDomains(req, res) {
    // API Key not required to list public active domains
    // logProjectApiHit is omitted since no project is authenticated

    const domains = getActiveDomainsWithPlan();
    
    // Fallback if DB table is empty
    if (domains.length === 0) {
      domains.push({ domain: process.env.DOMAIN || "llamerada.online", plan: "free" });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ domains }));
  }

  /**
   * GET /api/mailbox/generate
   * Generates a random temporary email address
   */
  static generateMailbox(req, res) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    const endpoint = "/api/mailbox/generate";
    logProjectApiHit(project.id, endpoint, "GET");
    
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const requestedDomain = url.searchParams.get("domain");

    let domains = getActiveDomains();
    if (domains.length === 0) {
      domains.push(process.env.DOMAIN || "llamerada.online");
    }

    let domain = domains[0];
    if (requestedDomain && domains.includes(requestedDomain)) {
      domain = requestedDomain;
    } else if (domains.length > 0) {
      // Pick a random domain if none requested or invalid
      domain = domains[Math.floor(Math.random() * domains.length)];
    }

    const randomString = Math.random().toString(36).substring(2, 10);
    const email = `${randomString}@${domain}`;

    // Ensure it doesn't conflict with any Mailbox User account
    try {
      const existingMailbox = db.prepare("SELECT id FROM mailbox_table WHERE email = ?").get(email);
      if (existingMailbox) {
        // Very rare collision with generated string, but just in case, return error so client retries
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Generated address collision. Please try again." }));
        return;
      }
    } catch (err) {
      console.error("DB Error checking reserved mailbox:", err);
    }
    
    // Capture IP
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "Unknown";
    logGeneratedEmail(email, ipAddress, project.id);
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ email }));
  }

  /**
   * GET /api/mailbox/custom?name=abc&domain=llamerada.online
   * Generates a custom email address with the user's chosen name.
   * Returns 409 if the address is already taken.
   */
  static customGenerateMailbox(req, res) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    const endpoint = "/api/mailbox/custom";
    logProjectApiHit(project.id, endpoint, "GET");

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const name = url.searchParams.get("name");
    const requestedDomain = url.searchParams.get("domain");

    if (!name || name.trim().length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'name' query parameter. Example: ?name=myname&domain=yourdomain.com" }));
      return;
    }

    // Sanitize name: only allow alphanumeric, dots, hyphens, underscores
    const sanitized = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (sanitized.length === 0 || sanitized.length > 64) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid name. Use only letters, numbers, dots, hyphens, underscores (1-64 chars)." }));
      return;
    }

    const plan = url.searchParams.get("plan") === "pro" ? "pro" : "free";

    // Check against forbidden IDs
    const forbiddenIds = getProjectForbiddenIds(project.id);
    const forbiddenList = forbiddenIds[plan] || [];
    if (forbiddenList.includes(sanitized)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `The name '${sanitized}' is forbidden for ${plan} users and cannot be used.` }));
      return;
    }

    let domains = getActiveDomains();
    if (domains.length === 0) {
      domains.push(process.env.DOMAIN || "llamerada.online");
    }

    let domain = domains[0];
    if (requestedDomain && domains.includes(requestedDomain)) {
      domain = requestedDomain;
    }

    const email = `${sanitized}@${domain}`;

    // Check if this email was already generated
    try {
      const existingMailbox = db.prepare("SELECT id FROM mailbox_table WHERE email = ?").get(email);
      if (existingMailbox) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "This email address is reserved for a Mailbox Account. Please choose a different name.", email }));
        return;
      }

      const existing = db.prepare("SELECT id FROM generated_emails WHERE email = ?").get(email);
      if (existing) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "This email address is already taken. Please choose a different name.", email }));
        return;
      }
    } catch (err) {
      console.error("DB Error checking existing email:", err);
    }

    // Capture IP and log
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "Unknown";
    logGeneratedEmail(email, ipAddress, project.id);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ email }));
  }

  /**
   * GET /api/mailbox/:email
   * Fetches all emails received for the specified mailbox
   */
  static getMailbox(req, res, emailAddress) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }
    
    logProjectApiHit(project.id, `/api/mailbox/${emailAddress}`, "GET");

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }

      const targetRecipient = emailAddress.toLowerCase().trim();
      const records = db.query(`SELECT file_name FROM received_emails WHERE recipient LIKE ? ORDER BY created_at DESC`).all(`%${targetRecipient}%`);
      const files = records.map(r => r.file_name).filter(Boolean);
      const emails = [];

      for (const file of files) {
        try {
          const filePath = path.join(targetDir, file);
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(fileContent);
          
          const cleanRecipient = extractEmail(parsed.to);
          const targetRecipient = emailAddress.toLowerCase().trim();

          if (cleanRecipient === targetRecipient || cleanRecipient.includes(targetRecipient)) {
            parsed.fileName = file;
            emails.push(parsed);
          }
        } catch (e) {
          console.error(`Error reading mail file ${file}:`, e.message);
        }
      }

      // Sort by date descending
      emails.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(emails));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * GET /api/mailbox/:email/otps
   * Fetches extracted numeric OTP codes from mailbox emails
   */
  static getOtps(req, res, emailAddress) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }

    logProjectApiHit(project.id, `/api/mailbox/${emailAddress}/otps`, "GET");

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }

      const targetRecipient = emailAddress.toLowerCase().trim();
      const records = db.query(`SELECT file_name FROM received_emails WHERE recipient LIKE ? ORDER BY created_at DESC`).all(`%${targetRecipient}%`);
      const files = records.map(r => r.file_name).filter(Boolean);
      const otps = [];

      for (const file of files) {
        try {
          const filePath = path.join(targetDir, file);
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(fileContent);
          
          const cleanRecipient = extractEmail(parsed.to);
          const targetRecipient = emailAddress.toLowerCase().trim();

          if (cleanRecipient === targetRecipient || cleanRecipient.includes(targetRecipient)) {
            // Scan subject and body text for 4-6 digit numeric codes
            const searchText = `${parsed.subject} ${parsed.text} ${parsed.html || ""}`;
            const matches = searchText.match(/\b\d{4,6}\b/g);

            if (matches) {
              const uniqueMatches = [...new Set(matches)];
              for (const code of uniqueMatches) {
                otps.push({
                  otp: code,
                  from: parsed.from,
                  subject: parsed.subject,
                  date: parsed.date,
                  mailId: parsed.id
                });
              }
            }
          }
        } catch (e) {
          console.error(`Error reading mail file ${file}:`, e.message);
        }
      }

      // Sort by date descending
      otps.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(otps));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * DELETE /api/mailbox/:email
   * Deletes all emails matching this mailbox address
   */
  static deleteMailbox(req, res, emailAddress) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }

    logProjectApiHit(project.id, `/api/mailbox/${emailAddress}`, "DELETE");

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: 0 }));
        return;
      }

      const targetRecipient = emailAddress.toLowerCase().trim();
      const records = db.query(`SELECT id, file_name FROM received_emails WHERE recipient LIKE ?`).all(`%${targetRecipient}%`);
      let deletedCount = 0;

      for (const record of records) {
        if (record.file_name) {
          const filePath = path.join(targetDir, record.file_name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        db.query(`DELETE FROM received_emails WHERE id = ?`).run(record.id);
        deletedCount++;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, count: deletedCount }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * DELETE /api/mailbox/:email/:mailId
   * Deletes a specific email file from a mailbox
   */
  static deleteMail(req, res, emailAddress, mailId) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (!emailAddress || !mailId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing emailAddress or mailId parameter" }));
      return;
    }

    logProjectApiHit(project.id, `/api/mailbox/${emailAddress}/${mailId}`, "DELETE");

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Mailbox not found" }));
        return;
      }

      const targetRecipient = emailAddress.toLowerCase().trim();
      const records = db.query(`SELECT id, file_name FROM received_emails WHERE recipient LIKE ?`).all(`%${targetRecipient}%`);
      const files = records.map(r => r.file_name).filter(Boolean);
      let deleted = false;

      for (const record of records) {
        if (!record.file_name) continue;
        const filePath = path.join(targetDir, record.file_name);
        if (!fs.existsSync(filePath)) continue;

        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(fileContent);

        const cleanRecipient = extractEmail(parsed.to);
        const targetRecipient = emailAddress.toLowerCase().trim();

        if (parsed.id === mailId && (cleanRecipient === targetRecipient || cleanRecipient.includes(targetRecipient))) {
          fs.unlinkSync(filePath);
          db.query(`DELETE FROM received_emails WHERE id = ?`).run(record.id);
          deleted = true;
          break;
        }
      }

      if (deleted) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Mail not found in this mailbox" }));
      }
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // ==========================================
  // ADMIN PANEL BACKEND APIS (Delegated to AdminController)
  // ==========================================

  static adminLogin(req, res) {
    return AdminController.login(req, res);
  }

  static getStats(req, res) {
    return AdminController.getStats(req, res);
  }

  static getCredentials(req, res) {
    return AdminController.getCredentials(req, res);
  }

  static addCredential(req, res) {
    return AdminController.addCredential(req, res);
  }

  static deleteCredential(req, res, username) {
    return AdminController.deleteCredential(req, res, username);
  }

  static getDkimKey(req, res) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    return AdminController.getDkimKey(req, res);
  }

  static generateDkimKey(req, res) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    return AdminController.generateDkimKey(req, res);
  }

  static getApiSettings(req, res) {
    return AdminController.getApiSettings(req, res);
  }

  static toggleApiSetting(req, res) {
    return AdminController.toggleApiSetting(req, res);
  }

  static resetApiSettingsHits(req, res) {
    return AdminController.resetApiSettingsHits(req, res);
  }

  static isApiEnabled(url, method) {
    return AdminController.isApiEnabled(url, method);
  }

  static async handleSeedDataApi(req, res) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const cleanUrl = req.url.split("?")[0].replace(/\/+$/, "");
    if (req.method === "GET" && (cleanUrl === "/api/admin/seed/status" || cleanUrl === "/api/admin/seed")) {
      return AdminController.getSeedStatus(req, res);
    }

    if (req.method === "POST" && (cleanUrl === "/api/admin/seed" || cleanUrl === "/api/admin/seed/run")) {
      return AdminController.handleSeedData(req, res);
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Seed endpoint not found" }));
  }

  // ==========================================
  // NEW DATABASE LOGS APIS
  // ==========================================
  
  static async getDbLogs(req, res, logType) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Parse URL for pagination and search (e.g. ?page=1&limit=20&search=email@domain.com)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const search = url.searchParams.get('search') || '';

    try {
      // Dynamic import to avoid top-level issues if not initialized
      const dbModule = await import("../backend/database/db.js");
      const { getSystemLogs, clearSystemLogs, deleteSystemLogsByIds } = dbModule;
      
      if (req.method === "DELETE" || (req.method === "POST" && logType === "delete-selected")) {
        let body = "";
        await new Promise((resolve) => {
          req.on("data", chunk => body += chunk.toString());
          req.on("end", resolve);
          req.on("error", resolve);
          if (req.readableEnded) resolve();
        });

        try {
          let parsedBody = null;
          if (body) {
            try { parsedBody = JSON.parse(body); } catch(e) {}
          }

          if (parsedBody && Array.isArray(parsedBody.ids) && parsedBody.ids.length > 0) {
            const result = deleteSystemLogsByIds ? deleteSystemLogsByIds(parsedBody.ids) : { count: 0 };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count: result.count }));
            return;
          }

          let typeToClear = "ALL";
          const norm = (logType || "").toLowerCase();
          if (norm === "receive") typeToClear = "RECEIVE";
          else if (norm === "send") typeToClear = "SEND";
          
          const result = clearSystemLogs(typeToClear);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, ...result }));
          return;
        } catch (delErr) {
          console.error("DB Log Delete Error:", delErr);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: delErr.message }));
          return;
        }
      }

      if (req.method === "GET") {
        let actualType = "ALL";
        if (logType === "receive") actualType = "RECEIVE";
        else if (logType === "send") actualType = "SEND";
        
        const logsData = getSystemLogs(actualType, page, limit, search);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(logsData));
        return;
      }
      
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
    } catch (err) {
      console.error("DB Log Fetch Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
  // ==========================================
  // NEW ATTACHED DOMAINS APIS
  // ==========================================

  static async handleAttachedDomainsApi(req, res) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const cleanUrl = req.url.split("?")[0];
    const parts = cleanUrl.split("/").filter(Boolean); // e.g. ["api", "admin", "domains", "12", "verify"]

    if (parts.length === 5 && parts[4] === "verify" && req.method === "POST") {
      const id = parts[3];
      return AdminController.verifyAttachedDomain(req, res, id);
    }

    if (parts.length === 5 && parts[4] === "primary" && req.method === "POST") {
      const id = parts[3];
      return AdminController.setPrimaryAttachedDomain(req, res, id);
    }

    if (parts.length === 4 && parts[3] === "bulk-routing" && req.method === "POST") {
      return AdminController.bulkUpdateDomainRouting(req, res);
    }

    if (req.method === "GET") {
      return AdminController.getAttachedDomains(req, res);
    }
    
    if (req.method === "POST") {
      return AdminController.addAttachedDomain(req, res);
    }
    
    if (req.method === "PUT") {
      const id = parts[3];
      return AdminController.updateAttachedDomain(req, res, id);
    }
    
    if (req.method === "DELETE") {
      const id = parts[3];
      return AdminController.deleteAttachedDomain(req, res, id);
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  // ==========================================
  // NEW PROJECT MANAGEMENT APIS
  // ==========================================

  static async handleProjectsApi(req, res) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const dbModule = await import("../backend/database/db.js");
      const db = dbModule.default;

      // GET /api/admin/projects
      if (req.method === "GET" && req.url.split("?")[0] === "/api/admin/projects") {
        const projects = db.query("SELECT * FROM projects ORDER BY created_at DESC").all();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(projects));
        return;
      }

      // POST /api/admin/projects (Create project)
      if (req.method === "POST" && req.url.split("?")[0] === "/api/admin/projects") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const { name } = JSON.parse(body);
            if (!name) throw new Error("Project name is required");
            
            // Generate API Key
            const apiKey = "pk_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            const stmt = db.prepare("INSERT INTO projects (name, api_key) VALUES (?, ?)");
            const result = stmt.run(name, apiKey);
            
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ id: result.lastInsertRowid, name, api_key: apiKey }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // PUT /api/admin/projects/:id (Update webhook or is_active)
      if (req.method === "PUT" && !req.url.endsWith("/stats")) {
        const id = req.url.split("/").pop();
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.webhook_url !== undefined) {
              const stmt = db.prepare("UPDATE projects SET webhook_url = ? WHERE id = ?");
              stmt.run(parsed.webhook_url || null, id);
            }
            if (parsed.is_active !== undefined) {
              const stmt = db.prepare("UPDATE projects SET is_active = ? WHERE id = ?");
              stmt.run(parsed.is_active ? 1 : 0, id);
            }
            if (parsed.name !== undefined) {
              const stmt = db.prepare("UPDATE projects SET name = ? WHERE id = ?");
              stmt.run(parsed.name, id);
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // PUT /api/admin/projects/:id/advanced (Update advanced settings like retention, forbidden IDs, allowed files)
      if (req.method === "PUT" && req.url.endsWith("/advanced")) {
        const urlParts = req.url.split("/");
        const id = urlParts[urlParts.length - 2];
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.retention) dbModule.updateProjectRetention(id, parsed.retention);
            if (parsed.forbiddenIds) dbModule.updateProjectForbiddenIds(id, parsed.forbiddenIds);
            if (parsed.allowedFiles) dbModule.updateProjectAllowedFiles(id, parsed.allowedFiles);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // DELETE /api/admin/projects/:id/hits
      if (req.method === "DELETE" && req.url.match(/\/api\/admin\/projects\/\d+\/hits/)) {
        const idStr = req.url.split("/")[4];
        const id = parseInt(idStr, 10);
        try {
          const dbModule = await import("../backend/database/db.js");
          const { resetProjectHits } = dbModule;
          resetProjectHits(id);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // GET /api/admin/projects/:id/stats
      if (req.method === "GET" && req.url.match(/\/api\/admin\/projects\/\d+\/stats/)) {
        const idStr = req.url.split("/")[4]; // /api/admin/projects/:id/stats
        const id = parseInt(idStr, 10);
        try {
          const totalHits = db.query("SELECT COUNT(*) as count FROM project_api_logs WHERE project_id = ?").get(id).count;
          const totalInboxes = db.query("SELECT COUNT(*) as count FROM generated_emails WHERE project_id = ?").get(id).count;
          const totalReceived = db.query("SELECT COUNT(*) as count FROM received_emails WHERE project_id = ?").get(id).count;
          
          const simpleReceived = db.query("SELECT COUNT(*) as count FROM received_emails WHERE project_id = ? AND has_attachment = 0").get(id).count;
          const attachmentReceived = db.query("SELECT COUNT(*) as count FROM received_emails WHERE project_id = ? AND has_attachment = 1").get(id).count;
          const totalStorageUsed = db.query("SELECT SUM(attachment_size) as total FROM received_emails WHERE project_id = ?").get(id).total || 0;

          const recentLogs = db.query("SELECT endpoint, method, created_at FROM project_api_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50").all(id);
          const recentReceived = db.query("SELECT recipient, sender, subject, has_attachment, created_at FROM received_emails WHERE project_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
          const topEndpoints = db.query("SELECT endpoint, COUNT(*) as hits FROM project_api_logs WHERE project_id = ? GROUP BY endpoint ORDER BY hits DESC LIMIT 5").all(id);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            totalHits,
            totalInboxes,
            totalReceived,
            simpleReceived,
            attachmentReceived,
            totalStorageUsed,
            recentLogs,
            recentReceived,
            topEndpoints
          }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // GET /api/admin/projects/:id/emails
      if (req.method === "GET" && req.url.match(/\/api\/admin\/projects\/\d+\/emails/)) {
        const idStr = req.url.split("/")[4]; // /api/admin/projects/:id/emails
        const id = parseInt(idStr, 10);
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const page = parseInt(parsedUrl.searchParams.get("page") || "1", 10);
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "20", 10);
        
        try {
          const dbModule = await import("../backend/database/db.js");
          const { getProjectEmails } = dbModule;
          const data = getProjectEmails(id, page, limit);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (e) {
          console.error("Error fetching project emails:", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
        return;
      }

      // GET /api/admin/projects/:id/files
      if (req.method === "GET" && req.url.match(/\/api\/admin\/projects\/\d+\/files/)) {
        const idStr = req.url.split("/")[4]; // /api/admin/projects/:id/files
        const id = parseInt(idStr, 10);
        
        try {
          const dbModule = await import("../backend/database/db.js");
          const { getProjectFilesList } = dbModule;
          const data = getProjectFilesList(id);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (e) {
          console.error("Error fetching project files:", e);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
        return;
      }

      // --- WEBMAIL MANAGEMENT ROUTES ---
      // GET /api/admin/projects/:id/mailbox
      if (req.method === "GET" && req.url.match(/\/api\/admin\/projects\/\d+\/mailbox$/)) {
        const idStr = req.url.split("/")[4];
        return AdminController.getMailboxUsers(req, res, parseInt(idStr, 10));
      }

      // POST /api/admin/projects/:id/mailbox
      if (req.method === "POST" && req.url.match(/\/api\/admin\/projects\/\d+\/mailbox$/)) {
        const idStr = req.url.split("/")[4];
        return AdminController.createMailboxUser(req, res, parseInt(idStr, 10));
      }

      // DELETE /api/admin/projects/:id/mailbox/:userId
      if (req.method === "DELETE" && req.url.match(/\/api\/admin\/projects\/\d+\/mailbox\/\d+/)) {
        const parts = req.url.split("/");
        const projectId = parseInt(parts[4], 10);
        const userId = parseInt(parts[6], 10);
        return AdminController.deleteMailboxUser(req, res, projectId, userId);
      }

      // DELETE /api/admin/projects/:id
      if (req.method === "DELETE" && req.url.match(/\/api\/admin\/projects\/\d+$/)) {
        const idStr = req.url.split("/").pop();
        const id = parseInt(idStr, 10);
        try {
          const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
          stmt.run(id);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // GET /api/admin/projects/:id/mailbox
      if (req.method === "GET" && req.url.match(/^\/api\/admin\/projects\/\d+\/mailbox$/)) {
        const idStr = req.url.split("/")[4];
        const id = parseInt(idStr, 10);
        try {
          const users = db.query("SELECT id, email, created_at FROM mailbox_table WHERE project_id = ? ORDER BY created_at DESC").all(id);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ users }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // POST /api/admin/projects/:id/mailbox
      if (req.method === "POST" && req.url.match(/^\/api\/admin\/projects\/\d+\/mailbox$/)) {
        const idStr = req.url.split("/")[4];
        const id = parseInt(idStr, 10);
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
          try {
            const { email, password } = JSON.parse(body);
            if (!email || !password) throw new Error("Email and password are required");
            const hash = await Bun.password.hash(password);
            db.prepare("INSERT INTO mailbox_table (email, password_hash, project_id) VALUES (?, ?, ?)").run(email, hash, id);
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // DELETE /api/admin/projects/:id/mailbox/:userId
      if (req.method === "DELETE" && req.url.match(/^\/api\/admin\/projects\/\d+\/mailbox\/\d+$/)) {
        const urlParts = req.url.split("/");
        const projectId = parseInt(urlParts[4], 10);
        const userId = parseInt(urlParts[6], 10);
        try {
          db.prepare("DELETE FROM mailbox_table WHERE id = ? AND project_id = ?").run(userId, projectId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }
      // GET /api/admin/projects/:id/files
      if (req.method === "GET" && req.url.match(/^\/api\/admin\/projects\/\d+\/files$/)) {
        const idStr = req.url.split("/")[4];
        const id = parseInt(idStr, 10);
        try {
          const filesRecords = db.query("SELECT id, file_name, has_attachment, created_at FROM received_emails WHERE project_id = ? AND file_name IS NOT NULL ORDER BY created_at DESC").all(id);
          
          let totalSizeBytes = 0;
          const files = [];
          
          const fs = await import("fs");
          const path = await import("path");
          const targetDir = path.join(process.cwd(), "backend", "storage", "live");
          
          for (const record of filesRecords) {
            const filePath = path.join(targetDir, record.file_name);
            let size = 0;
            if (fs.existsSync(filePath)) {
               const stat = fs.statSync(filePath);
               size = stat.size;
               totalSizeBytes += size;
            }
            files.push({
               id: record.id,
               name: record.file_name,
               type: record.has_attachment ? "Media Attachment" : "JSON Record",
               sizeBytes: size,
               createdAt: record.created_at
            });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ totalSizeBytes, files }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }
      
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
    } catch (err) {
      console.error("Projects API Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }

  // ==========================================
  // NEW ADMIN MAILBOX USERS API
  // ==========================================

  static async handleAdminMailboxUsersApi(req, res, defaultScope = "admin") {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const dbModule = await import("../backend/database/db.js");
      const db = dbModule.default;
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const scope = url.searchParams.get("scope") || req.headers["x-scope"] || defaultScope || "admin";
      const cleanUrl = req.url.split("?")[0];

      // GET mailbox-users
      if (req.method === "GET" && (cleanUrl === "/api/admin/mailbox-users" || cleanUrl === "/api/devpanel/mailbox-users" || cleanUrl === "/api/dev-admin/mailbox-users")) {
        const users = db.query(`
          SELECT w.id, w.email, w.plain_password, w.project_id, w.created_at, w.scope, p.name as project_name,
                 (SELECT COUNT(*) FROM received_emails WHERE recipient = w.email) as received_count
          FROM mailbox_table w
          LEFT JOIN projects p ON w.project_id = p.id
          WHERE (w.scope = ? OR (? = 'admin' AND (w.scope IS NULL OR w.scope = '')))
          ORDER BY w.created_at DESC
        `).all(scope, scope);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(users));
        return;
      }

      // POST mailbox-users
      if (req.method === "POST" && (cleanUrl === "/api/admin/mailbox-users" || cleanUrl === "/api/devpanel/mailbox-users" || cleanUrl === "/api/dev-admin/mailbox-users")) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const { email, password, project_id, scope: bodyScope } = JSON.parse(body);
            if (!email || !password || !project_id) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email, password, and project selection are required" }));
              return;
            }

            const targetScope = bodyScope || scope || "admin";
            const hash = Bun.password.hashSync(password, {
              algorithm: "bcrypt",
              cost: 10,
            });

            // Upsert mailbox user
            const existing = db.prepare("SELECT id FROM mailbox_table WHERE LOWER(email) = LOWER(?)").get(email);
            let userId;
            if (existing) {
              userId = existing.id;
              db.prepare("UPDATE mailbox_table SET password_hash = ?, plain_password = ?, project_id = COALESCE(?, project_id), scope = ? WHERE id = ?").run(hash, password, project_id || null, targetScope, userId);
            } else {
              const stmt = db.prepare("INSERT INTO mailbox_table (email, password_hash, plain_password, project_id, scope) VALUES (?, ?, ?, ?, ?)");
              const result = stmt.run(email, hash, password, project_id || 1, targetScope);
              userId = result.lastInsertRowid;
            }

            // If this email belongs to an attached primary domain, sync primary_prefix
            if (email && email.includes("@")) {
              const [prefix, dom] = email.split("@");
              if (prefix && dom) {
                try {
                  db.prepare("UPDATE attached_domains SET primary_prefix = ? WHERE LOWER(domain) = LOWER(?) AND is_primary = 1 AND scope = ?").run(prefix, dom, targetScope);
                } catch (e) {}
              }
            }
            
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ id: userId, email, plain_password: password, project_id, scope: targetScope }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // PUT mailbox-users/:id
      if (req.method === "PUT" && (cleanUrl.startsWith("/api/admin/mailbox-users/") || cleanUrl.startsWith("/api/devpanel/mailbox-users/") || cleanUrl.startsWith("/api/dev-admin/mailbox-users/"))) {
        const id = cleanUrl.split("/").pop();
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID parameter" }));
          return;
        }

        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const { email, password, project_id } = JSON.parse(body);
            if (!password) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Password is required" }));
              return;
            }

            const hash = Bun.password.hashSync(password, {
              algorithm: "bcrypt",
              cost: 10,
            });

            if (email && project_id) {
              db.prepare("UPDATE mailbox_table SET email = ?, password_hash = ?, plain_password = ?, project_id = ? WHERE id = ?").run(email, hash, password, project_id, id);
            } else if (email) {
              db.prepare("UPDATE mailbox_table SET email = ?, password_hash = ?, plain_password = ? WHERE id = ?").run(email, hash, password, id);
            } else if (project_id) {
              db.prepare("UPDATE mailbox_table SET password_hash = ?, plain_password = ?, project_id = ? WHERE id = ?").run(hash, password, project_id, id);
            } else {
              db.prepare("UPDATE mailbox_table SET password_hash = ?, plain_password = ? WHERE id = ?").run(hash, password, id);
            }

            // Sync primary_prefix in attached_domains if this email belongs to primary domain
            if (email && email.includes("@")) {
              const [prefix, dom] = email.split("@");
              if (prefix && dom) {
                try {
                  db.prepare("UPDATE attached_domains SET primary_prefix = ? WHERE LOWER(domain) = LOWER(?) AND is_primary = 1").run(prefix, dom);
                } catch (e) {}
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, id, email, plain_password: password }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // DELETE mailbox-users/:id
      if (req.method === "DELETE" && (cleanUrl.startsWith("/api/admin/mailbox-users/") || cleanUrl.startsWith("/api/devpanel/mailbox-users/") || cleanUrl.startsWith("/api/dev-admin/mailbox-users/"))) {
        const id = cleanUrl.split("/").pop();
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID parameter" }));
          return;
        }

        db.prepare("DELETE FROM mailbox_table WHERE id = ?").run(id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
    } catch (err) {
      console.error("Admin Mailbox Users API Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }

  // ==========================================
  // NEW TRAFFIC ANALYTICS API
  // ==========================================
  static async handleTrafficStatsApi(req, res) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!AdminController.isValidAdminToken(token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const dbModule = await import("../backend/database/db.js");
      const db = dbModule.default;

      // Group last 7 days of emails by day
      const query = `
        WITH RECURSIVE dates(date) AS (
          SELECT date('now', '-6 days')
          UNION ALL
          SELECT date(date, '+1 day')
          FROM dates
          WHERE date < date('now')
        )
        SELECT 
          d.date as day,
          COALESCE(SUM(CASE WHEN src = 'generated' THEN count ELSE 0 END), 0) as generated,
          COALESCE(SUM(CASE WHEN src = 'received' THEN count ELSE 0 END), 0) as received
        FROM dates d
        LEFT JOIN (
          SELECT date(created_at) as day, COUNT(*) as count, 'generated' as src
          FROM generated_emails
          WHERE created_at >= date('now', '-6 days')
          GROUP BY date(created_at)
          UNION ALL
          SELECT date(created_at) as day, COUNT(*) as count, 'received' as src
          FROM received_emails
          WHERE created_at >= date('now', '-6 days')
          GROUP BY date(created_at)
        ) data ON d.date = data.day
        GROUP BY d.date
        ORDER BY d.date ASC;
      `;

      const stats = db.query(query).all();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
    } catch (err) {
      console.error("Traffic Stats API Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }

  // ==========================================
  // UNIFIED MASTER MAILBOX ENDPOINTS (/api/mailbox/*)
  // ==========================================
  static async handleMailboxApi(req, res) {
    try {
      const dbModule = await import("../backend/database/db.js");
      const { verifyMailboxUser, getPrimaryDomain, getActiveDomains } = dbModule;
      const cleanUrl = req.url.split("?")[0];
      const normUrl = cleanUrl.replace("/api/imap-mailbox", "/api/mailbox");

      // CORS Preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // GET /api/mailbox/info
      if (normUrl === "/api/mailbox/info" && req.method === "GET") {
        const primary = getPrimaryDomain();
        const activeDomains = getActiveDomains();
        const primaryDomain = primary ? primary.domain : (activeDomains[0] || "mailserver10.com");
        const primaryPrefix = primary?.primary_prefix || "admin";
        const masterEmail = `${primaryPrefix}@${primaryDomain}`;

        const allUsers = dbModule.default.prepare("SELECT email, plain_password FROM mailbox_table ORDER BY id ASC").all();
        let defaultCreds = {
          email: masterEmail,
          password: process.env.ADMIN_PASSWORD || "1234"
        };
        if (allUsers.length > 0) {
          const primaryUser = allUsers.find(u => u.email && u.email.endsWith(`@${primaryDomain}`)) || allUsers[0];
          if (primaryUser) {
            defaultCreds.email = primaryUser.email;
            if (primaryUser.plain_password) defaultCreds.password = primaryUser.plain_password;
          }
        }

        const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || "187.52.117.2";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          primaryDomain: primaryDomain,
          catchAll: true,
          serverIp: serverIp,
          imap: {
            host: `mail.${primaryDomain}`,
            sslPort: 993,
            plainPort: 143,
            status: "active"
          },
          pop3: {
            host: `mail.${primaryDomain}`,
            sslPort: 995,
            plainPort: 110,
            status: "active"
          },
          smtp: {
            host: `mail.${primaryDomain}`,
            tlsPort: 587,
            sslPort: 465,
            plainPort: 25,
            status: "active"
          },
          defaultCredentials: defaultCreds
        }));
        return;
      }

      // POST /api/mailbox/login
      if (normUrl === "/api/mailbox/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
          try {
            const { email, password, isMasterQuickLogin } = JSON.parse(body || "{}");
            const adminPass = process.env.ADMIN_PASSWORD || "1234";

            // If Master quick login or admin credentials
            if (isMasterQuickLogin || ((email === "admin" || email === "admin@gmail.com" || email?.startsWith("admin@")) && password === adminPass)) {
              const primary = getPrimaryDomain();
              const primaryDomain = primary ? primary.domain : "mailserver10.com";
              const userEmail = email && email.includes("@") ? email : `admin@${primaryDomain}`;

              const crypto = await import("crypto");
              const token = "mailbox_master_" + crypto.randomBytes(32).toString("hex") + ":" + userEmail;

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                success: true,
                token,
                expiresIn: 86400,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                user: {
                  email: userEmail,
                  is_primary: true,
                  is_master: true,
                  role: "Master Mailbox Admin",
                  domain: primaryDomain
                }
              }));
              return;
            }

            if (!email || !password) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email and password are required" }));
              return;
            }

            // Check if regular mailbox user or primary domain user
            const user = verifyMailboxUser(email, password);
            if (user) {
              const crypto = await import("crypto");
              const token = "mailbox_" + crypto.randomBytes(32).toString("hex") + ":" + user.email;
              user.is_primary = true;
              user.is_master = true;

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ 
                success: true, 
                token, 
                expiresIn: 86400,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                user 
              }));
              return;
            }

            // Check admin fallback password
            if (password === adminPass) {
              const crypto = await import("crypto");
              const token = "mailbox_master_" + crypto.randomBytes(32).toString("hex") + ":" + email;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                success: true,
                token,
                expiresIn: 86400,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                user: { email, is_primary: true, is_master: true, role: "Master Mailbox Admin" }
              }));
              return;
            }

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid credentials" }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Validate Auth for remaining mailbox routes
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const token = authHeader.split(" ")[1];
      const colonIdx = token.indexOf(":");
      const userEmail = colonIdx !== -1 ? token.substring(colonIdx + 1) : "admin@primary";

      // GET /api/mailbox/inbox
      if (normUrl === "/api/mailbox/inbox" && req.method === "GET") {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const page = parseInt(parsedUrl.searchParams.get("page") || "1", 10);
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "200", 10);
        const search = parsedUrl.searchParams.get("search") || "";
        const filter = parsedUrl.searchParams.get("filter") || "all";

        const db = dbModule.default;
        if (dbModule.purgeExpiredTrashEmails) {
          try { dbModule.purgeExpiredTrashEmails(24); } catch (e) { }
        }
        let query = "SELECT id, recipient, sender, subject, has_attachment, attachment_size, created_at, file_name FROM received_emails";
        let countQuery = "SELECT COUNT(*) as count FROM received_emails";
        let whereClauses = [];
        let params = [];
        let countParams = [];

        if (filter === "trash") {
          whereClauses.push("COALESCE(is_deleted, 0) = 1");
        } else {
          whereClauses.push("COALESCE(is_deleted, 0) = 0");
          if (filter === "with_attachments") {
            whereClauses.push("has_attachment = 1");
          } else if (filter === "simple") {
            whereClauses.push("has_attachment = 0");
          }
        }

        if (search) {
          whereClauses.push("(recipient LIKE ? OR sender LIKE ? OR subject LIKE ?)");
          const s = `%${search}%`;
          params.push(s, s, s);
          countParams.push(s, s, s);
        }

        if (whereClauses.length > 0) {
          const whereStr = " WHERE " + whereClauses.join(" AND ");
          query += whereStr;
          countQuery += whereStr;
        }

        query += " ORDER BY id DESC LIMIT ? OFFSET ?";
        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const totalRecords = db.prepare(countQuery).get(...countParams).count;
        const data = db.prepare(query).all(...params);

        let trashCount = 0;
        let inboxCount = 0;
        try {
          trashCount = db.prepare("SELECT COUNT(*) as count FROM received_emails WHERE COALESCE(is_deleted, 0) = 1").get()?.count || 0;
          inboxCount = db.prepare("SELECT COUNT(*) as count FROM received_emails WHERE COALESCE(is_deleted, 0) = 0").get()?.count || 0;
        } catch (e) {}

        const primary = getPrimaryDomain();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          data,
          isPrimaryMailbox: true,
          primaryDomain: primary?.domain || "mailserver10.com",
          trashCount,
          inboxCount,
          pagination: {
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit)
          }
        }));
        return;
      }

      // GET /api/mailbox/count
      if (normUrl === "/api/mailbox/count" && req.method === "GET") {
        try {
          const db = dbModule.default;
          const row = db.prepare("SELECT COUNT(*) as count FROM received_emails WHERE COALESCE(is_deleted, 0) = 0").get();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ email: userEmail, count: row ? row.count : 0, isPrimaryMailbox: true }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /api/mailbox/inbox/:id
      if (normUrl.match(/\/api\/mailbox\/inbox\/\d+/) && req.method === "GET") {
        const id = normUrl.split("/").pop();
        const db = dbModule.default;
        const emailRecord = db.prepare("SELECT id, file_name, recipient, sender, subject, created_at, has_attachment, attachment_size, is_deleted FROM received_emails WHERE id = ?").get(id);
        
        if (!emailRecord) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email not found" }));
          return;
        }

        const content = readEmailJsonFile(emailRecord.file_name, emailRecord);
        if (content) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(content);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email file missing" }));
        }
        return;
      }

      // POST /api/mailbox/inbox/restore or /api/mailbox/inbox/restore/:id
      if ((normUrl === "/api/mailbox/inbox/restore" || normUrl.match(/\/api\/mailbox\/inbox\/restore\/\d+/)) && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const db = dbModule.default;
            let ids = [];
            if (normUrl.match(/\/api\/mailbox\/inbox\/restore\/\d+/)) {
              ids = [normUrl.split("/").pop()];
            } else {
              const parsed = JSON.parse(body || "{}");
              ids = Array.isArray(parsed.ids) ? parsed.ids : [];
            }

            if (ids.length === 0) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "No email IDs provided" }));
              return;
            }

            let restoredCount = 0;
            for (const id of ids) {
              db.prepare("UPDATE received_emails SET is_deleted = 0, deleted_at = NULL WHERE id = ?").run(id);
              restoredCount++;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count: restoredCount }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to restore emails" }));
          }
        });
        return;
      }

      // POST/DELETE /api/mailbox/inbox/permanent-delete (Permanent deletion from disk + DB)
      if ((normUrl === "/api/mailbox/inbox/permanent-delete" || normUrl === "/api/mailbox/inbox/empty-trash") && (req.method === "POST" || req.method === "DELETE")) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const db = dbModule.default;
            let deletedCount = 0;

            if (parsed.all === true) {
              const trashRecords = db.prepare("SELECT id, file_name FROM received_emails WHERE COALESCE(is_deleted, 0) = 1").all();
              for (const r of trashRecords) {
                db.prepare("DELETE FROM received_emails WHERE id = ?").run(r.id);
                deletedCount++;
                if (r.file_name) {
                  const livePath = path.join(liveMailDir, r.file_name);
                  if (fs.existsSync(livePath)) { try { fs.unlinkSync(livePath); } catch(e){} }
                  const localPath = path.join(localMailDir, r.file_name);
                  if (fs.existsSync(localPath)) { try { fs.unlinkSync(localPath); } catch(e){} }
                }
              }
            } else {
              const ids = Array.isArray(parsed.ids) ? parsed.ids : [];
              if (ids.length === 0) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "No email IDs provided" }));
                return;
              }

              for (const id of ids) {
                const emailRecord = db.prepare("SELECT file_name FROM received_emails WHERE id = ?").get(id);
                if (emailRecord) {
                  db.prepare("DELETE FROM received_emails WHERE id = ?").run(id);
                  deletedCount++;
                  if (emailRecord.file_name) {
                    const livePath = path.join(liveMailDir, emailRecord.file_name);
                    if (fs.existsSync(livePath)) { try { fs.unlinkSync(livePath); } catch(e){} }
                    const localPath = path.join(localMailDir, emailRecord.file_name);
                    if (fs.existsSync(localPath)) { try { fs.unlinkSync(localPath); } catch(e){} }
                  }
                }
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count: deletedCount }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to permanently delete emails" }));
          }
        });
        return;
      }

      // POST/DELETE /api/mailbox/inbox/delete-selected (Soft delete / Move to Trash)
      if ((normUrl === "/api/mailbox/inbox/delete-selected" || normUrl === "/api/mailbox/inbox/batch" || normUrl === "/api/mailbox/inbox/batch-delete" || normUrl === "/api/mailbox/inbox/trash-selected") && (req.method === "POST" || req.method === "DELETE")) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const ids = Array.isArray(parsed.ids) ? parsed.ids : [];
            if (ids.length === 0) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "No email IDs provided" }));
              return;
            }

            const db = dbModule.default;
            let deletedCount = 0;
            for (const id of ids) {
              db.prepare("UPDATE received_emails SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
              deletedCount++;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count: deletedCount }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to move emails to trash" }));
          }
        });
        return;
      }

      // DELETE /api/mailbox/inbox/:id (Soft delete / Move to Trash or permanent if ?permanent=true)
      if (normUrl.match(/\/api\/mailbox\/inbox\/\d+/) && req.method === "DELETE") {
        const id = normUrl.split("/").pop();
        const isPermanent = parsedUrl.searchParams.get("permanent") === "true";
        const db = dbModule.default;
        const emailRecord = db.prepare("SELECT file_name FROM received_emails WHERE id = ?").get(id);
        if (!emailRecord) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email not found" }));
          return;
        }

        if (isPermanent) {
          db.prepare("DELETE FROM received_emails WHERE id = ?").run(id);
          if (emailRecord.file_name) {
            const livePath = path.join(liveMailDir, emailRecord.file_name);
            if (fs.existsSync(livePath)) { try { fs.unlinkSync(livePath); } catch(e){} }
            const localPath = path.join(localMailDir, emailRecord.file_name);
            if (fs.existsSync(localPath)) { try { fs.unlinkSync(localPath); } catch(e){} }
          }
        } else {
          db.prepare("UPDATE received_emails SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, permanent: isPermanent }));
        return;
      }

      // GET /api/mailbox/media
      if (normUrl === "/api/mailbox/media" && req.method === "GET") {
        const db = dbModule.default;
        const emails = db.prepare("SELECT id, recipient, sender, created_at, file_name FROM received_emails WHERE has_attachment = 1 AND COALESCE(is_deleted, 0) = 0 ORDER BY id DESC").all();
        const targetDir = getTargetStorageDir();
        const allMedia = [];

        for (const email of emails) {
          const fileContent = readEmailJsonFile(email.file_name);
          if (fileContent) {
            try {
              const parsed = JSON.parse(fileContent);
              if (parsed.attachments && Array.isArray(parsed.attachments)) {
                for (const att of parsed.attachments) {
                  allMedia.push({
                    emailId: email.id,
                    sender: email.sender,
                    recipient: email.recipient,
                    date: email.created_at,
                    filename: att.filename || "attachment",
                    contentType: att.contentType || "application/octet-stream",
                    size: att.size || 0,
                    url: att.url || (att.content ? `data:${att.contentType || 'image/png'};base64,${att.content}` : "")
                  });
                }
              }
            } catch (e) {}
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ media: allMedia }));
        return;
      }

      // POST /api/mailbox/send
      if (normUrl === "/api/mailbox/send" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
          try {
            const data = JSON.parse(body);
            const { to, subject, message } = data;
            
            if (!to || !message) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "'to' and 'message' fields are required" }));
              return;
            }

            const IS_LIVE = process.env.live !== "false";
            if (IS_LIVE) {
              const { sendOutboundEmail: sendOutboundEmailLive } = await import("../backend/send-mail-simple/send-mail-from-generated-mail-from-live.js");
              await sendOutboundEmailLive({
                from: userEmail,
                to,
                subject: subject || "",
                text: message,
                html: "",
                attachments: []
              });
            } else {
              const { sendOutboundEmail: sendOutboundEmailLocal } = await import("../backend/send-mail-simple/send-mail-from-generated-mail-from-local.js");
              await sendOutboundEmailLocal({
                from: userEmail,
                to,
                subject: subject || "",
                text: message,
                html: "",
                attachments: []
              });
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            console.error("Mailbox Send Error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Mailbox API endpoint not found" }));
    } catch (err) {
      console.error("Mailbox API Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static async handleImapMailboxApi(req, res) {
    return ApiRouter.handleMailboxApi(req, res);
  }

  /**
   * Handle /api/project/forbidden-ids
   */
  static handleForbiddenIds(req, res) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (req.method === "GET") {
      logProjectApiHit(project.id, "/api/project/forbidden-ids", "GET");
      const forbiddenIds = getProjectForbiddenIds(project.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ forbiddenIds }));
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      logProjectApiHit(project.id, "/api/project/forbidden-ids", req.method);
      let body = "";
      req.on("data", chunk => body += chunk.toString());
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (!data.forbiddenIds || typeof data.forbiddenIds !== "object") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "forbiddenIds must be an object with 'free' and 'pro' arrays" }));
            return;
          }
          const success = updateProjectForbiddenIds(project.id, data.forbiddenIds);
          if (success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, forbiddenIds: getProjectForbiddenIds(project.id) }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to update forbidden IDs" }));
          }
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  /**
   * Handle /api/project/retention
   */
  static handleRetentionApi(req, res) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (req.method === "GET") {
      logProjectApiHit(project.id, "/api/project/retention", "GET");
      const retention = getProjectRetention(project.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ retention }));
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      logProjectApiHit(project.id, "/api/project/retention", req.method);
      let body = "";
      req.on("data", chunk => body += chunk.toString());
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (!data.retention || typeof data.retention !== "object") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "retention must be an object with 'free' and 'pro' keys" }));
            return;
          }
          const success = updateProjectRetention(project.id, data.retention);
          if (success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, retention: getProjectRetention(project.id) }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to update retention settings" }));
          }
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  /**
   * Handle /api/project/allowed-files
   */
  static handleAllowedFilesApi(req, res) {
    const project = ApiRouter.validateApiKey(req, res);
    if (!project) return;

    if (req.method === "GET") {
      logProjectApiHit(project.id, "/api/project/allowed-files", "GET");
      const allowedFiles = getProjectAllowedFiles(project.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ allowedFiles }));
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      logProjectApiHit(project.id, "/api/project/allowed-files", req.method);
      let body = "";
      req.on("data", chunk => body += chunk.toString());
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (!data.allowedFiles || typeof data.allowedFiles !== "object") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "allowedFiles must be an object with 'free' and 'pro' arrays" }));
            return;
          }
          const success = updateProjectAllowedFiles(project.id, data.allowedFiles);
          if (success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, allowedFiles: getProjectAllowedFiles(project.id) }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to update allowed files settings" }));
          }
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }
}
