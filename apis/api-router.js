import fs from "fs";
import path from "path";
import { AdminController } from "../backend/admin/admin-controller.js";
import db, { logGeneratedEmail, getProjectByApiKey, logProjectApiHit, getActiveDomains } from "../backend/database/db.js";

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

    const domains = getActiveDomains();
    
    // Fallback if DB table is empty
    if (domains.length === 0) {
      domains.push(process.env.DOMAIN || "llamerada.online");
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
      const dbModule = require("../backend/database/db.js");
      const db = dbModule.default;
      const existingMailbox = db.prepare("SELECT id FROM mailbox_users WHERE email = ?").get(email);
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
      const dbModule = require("../backend/database/db.js");
      const db = dbModule.default;
      
      const existingMailbox = db.prepare("SELECT id FROM mailbox_users WHERE email = ?").get(email);
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
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    return AdminController.getDkimKey(req, res);
  }

  static generateDkimKey(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
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

  static isApiEnabled(url, method) {
    return AdminController.isApiEnabled(url, method);
  }

  // ==========================================
  // NEW DATABASE LOGS APIS
  // ==========================================
  
  static async getDbLogs(req, res, logType) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Parse URL for pagination (e.g. ?page=1&limit=20)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    try {
      // Dynamic import to avoid top-level issues if not initialized
      const dbModule = await import("../backend/database/db.js");
      const { getSystemLogs, clearSystemLogs } = dbModule;
      
      if (req.method === "DELETE") {
        let typeToClear = "ALL";
        if (logType === "receive") typeToClear = "RECEIVE";
        else if (logType === "send") typeToClear = "SEND";
        
        clearSystemLogs(typeToClear);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === "GET") {
        let actualType = "ALL";
        if (logType === "receive") actualType = "RECEIVE";
        else if (logType === "send") actualType = "SEND";
        
        const logsData = getSystemLogs(actualType, page, limit);

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
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.method === "GET") {
      return AdminController.getAttachedDomains(req, res);
    }
    
    if (req.method === "POST") {
      return AdminController.addAttachedDomain(req, res);
    }
    
    if (req.method === "PUT") {
      const id = req.url.split("/").pop();
      return AdminController.updateAttachedDomain(req, res, id);
    }
    
    if (req.method === "DELETE") {
      const id = req.url.split("/").pop();
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
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
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

      // PUT /api/admin/projects/:id/retention (Update data retention settings)
      if (req.method === "PUT" && req.url.endsWith("/retention")) {
        const urlParts = req.url.split("/");
        const id = urlParts[urlParts.length - 2];
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            dbModule.updateProjectRetention(id, parsed);
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
        return;
      }

      // GET /api/admin/projects/:id/mailbox
      if (req.method === "GET" && req.url.match(/^\/api\/admin\/projects\/\d+\/mailbox$/)) {
        const idStr = req.url.split("/")[4];
        const id = parseInt(idStr, 10);
        try {
          const users = db.query("SELECT id, email, created_at FROM mailbox_users WHERE project_id = ? ORDER BY created_at DESC").all(id);
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
            db.prepare("INSERT INTO mailbox_users (email, password_hash, project_id) VALUES (?, ?, ?)").run(email, hash, id);
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
          db.prepare("DELETE FROM mailbox_users WHERE id = ? AND project_id = ?").run(userId, projectId);
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
  // NEW ADMIN WEBMAIL USERS API
  // ==========================================

  static async handleAdminMailboxUsersApi(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const dbModule = await import("../backend/database/db.js");
      const db = dbModule.default;
      const cleanUrl = req.url.split("?")[0];

      // GET /api/admin/mailbox-users
      if (req.method === "GET" && cleanUrl === "/api/admin/mailbox-users") {
        const users = db.query(`
          SELECT w.id, w.email, w.project_id, w.created_at, p.name as project_name,
                 (SELECT COUNT(*) FROM received_emails WHERE recipient = w.email) as received_count
          FROM mailbox_users w
          LEFT JOIN projects p ON w.project_id = p.id
          ORDER BY w.created_at DESC
        `).all();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(users));
        return;
      }

      // POST /api/admin/mailbox-users
      if (req.method === "POST" && cleanUrl === "/api/admin/mailbox-users") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", () => {
          try {
            const { email, password, project_id } = JSON.parse(body);
            if (!email || !password || !project_id) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email, password, and project selection are required" }));
              return;
            }

            const hash = Bun.password.hashSync(password, {
              algorithm: "bcrypt",
              cost: 10,
            });

            const stmt = db.prepare("INSERT INTO mailbox_users (email, password_hash, project_id) VALUES (?, ?, ?)");
            const result = stmt.run(email, hash, project_id);
            
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ id: result.lastInsertRowid, email, project_id }));
          } catch (err) {
            if (err.message && err.message.includes("UNIQUE constraint failed")) {
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Mailbox user with this email already exists" }));
            } else {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message }));
            }
          }
        });
        return;
      }

      // DELETE /api/admin/mailbox-users/:id
      if (req.method === "DELETE" && cleanUrl.startsWith("/api/admin/mailbox-users/")) {
        const id = cleanUrl.split("/").pop();
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing ID parameter" }));
          return;
        }

        db.prepare("DELETE FROM mailbox_users WHERE id = ?").run(id);
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
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== AdminController.adminToken) {
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
  // NEW WEBMAIL API
  // ==========================================
  static async handleMailboxApi(req, res) {
    try {
      const dbModule = await import("../backend/database/db.js");
      const { verifyMailboxUser, getMailboxInbox } = dbModule;
      const cleanUrl = req.url.split("?")[0];

      // CORS Preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // POST /api/mailbox/login
      if (cleanUrl === "/api/mailbox/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
          try {
            const { email, password } = JSON.parse(body);
            if (!email || !password) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email and password are required" }));
              return;
            }

            const user = verifyMailboxUser(email, password);
            if (!user) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid email or password" }));
              return;
            }

            // Simple token generation (in production, use jsonwebtoken)
            const crypto = await import("crypto");
            const token = crypto.randomBytes(32).toString("hex") + ":" + user.email;

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, token, user }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Authentication Middleware for the rest
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const token = authHeader.split(" ")[1];
      const parts = token.split(":");
      if (parts.length !== 2) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid token" }));
        return;
      }
      const userEmail = parts[1];

      // GET /api/mailbox/inbox
      if (cleanUrl === "/api/mailbox/inbox" && req.method === "GET") {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const page = parseInt(parsedUrl.searchParams.get("page") || "1", 10);
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "50", 10);

        const data = getMailboxInbox(userEmail, page, limit);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
        return;
      }

      // POST /api/mailbox/send
      if (cleanUrl === "/api/mailbox/send" && req.method === "POST") {
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

      // GET /api/mailbox/inbox/:id
      if (cleanUrl.match(/\/api\/mailbox\/inbox\/\d+/) && req.method === "GET") {
        const id = cleanUrl.split("/").pop();
        
        // Fetch the specific email directly to ensure it belongs to this user
        const db = dbModule.default;
        const emailRecord = db.prepare("SELECT file_name, recipient FROM received_emails WHERE id = ?").get(id);
        
        if (!emailRecord || emailRecord.recipient !== userEmail) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email not found" }));
          return;
        }

        const targetDir = getTargetStorageDir();
        const filePath = path.join(targetDir, emailRecord.file_name);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(content);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email file missing" }));
        }
        return;
      }
      // DELETE /api/mailbox/inbox/:id
      if (cleanUrl.match(/\/api\/mailbox\/inbox\/\d+/) && req.method === "DELETE") {
        const id = cleanUrl.split("/").pop();
        const db = dbModule.default;
        
        const emailRecord = db.prepare("SELECT file_name, recipient FROM received_emails WHERE id = ?").get(id);
        if (!emailRecord || emailRecord.recipient !== userEmail) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email not found" }));
          return;
        }

        db.prepare("DELETE FROM received_emails WHERE id = ?").run(id);

        const targetDir = getTargetStorageDir();
        const filePath = path.join(targetDir, emailRecord.file_name);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // GET /api/mailbox/media
      if (cleanUrl === "/api/mailbox/media" && req.method === "GET") {
        const db = dbModule.default;
        const emails = db.prepare("SELECT id, sender, created_at, file_name FROM received_emails WHERE recipient = ? AND has_attachment = 1 ORDER BY id DESC").all(userEmail);
        
        const targetDir = getTargetStorageDir();
        const allMedia = [];

        for (const email of emails) {
          const filePath = path.join(targetDir, email.file_name);
          if (fs.existsSync(filePath)) {
            try {
              const content = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(content);
              if (parsed.attachments && Array.isArray(parsed.attachments)) {
                parsed.attachments.forEach((att, index) => {
                  allMedia.push({
                    emailId: email.id,
                    sender: email.sender,
                    date: email.created_at,
                    filename: att.filename || `attachment-${index}`,
                    contentType: att.contentType,
                    size: att.size || 0,
                    url: att.url
                  });
                });
              }
            } catch (err) {
              console.error("Error reading media for email", email.id, err);
            }
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ media: allMedia }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
      console.error("Mailbox API Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
}
