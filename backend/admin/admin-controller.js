import fs from "fs";
import path from "path";

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

// Available APIs config list with category and stats
const apiSettings = [
  { id: "mailbox-generate", method: "GET", path: "/api/mailbox/generate", desc: "Generate a new random temporary mailbox email address", enabled: true, category: "Mailbox UI", hits: 0 },
  { id: "mailbox-get", method: "GET", path: "/api/mailbox/:email", desc: "Retrieve list of all received emails in a mailbox", enabled: true, category: "Mailbox UI", hits: 0 },
  { id: "mailbox-delete", method: "DELETE", path: "/api/mailbox/:email", desc: "Delete all emails in a mailbox database", enabled: true, category: "Mailbox UI", hits: 0 },
  { id: "mailbox-otps", method: "GET", path: "/api/mailbox/:email/otps", desc: "Scan mailbox emails and parse numeric OTP codes", enabled: true, category: "Mailbox UI", hits: 0 },
  { id: "local-emails", method: "GET", path: "/api/emails/local", desc: "Fetch local inbox emails and local SMTP logs", enabled: true, category: "Local Console", hits: 0 },
  { id: "live-emails", method: "GET", path: "/api/emails/live", desc: "Fetch live inbox emails and live SMTP traffic logs", enabled: true, category: "Live Console", hits: 0 },
  { id: "delete-local", method: "POST", path: "/api/emails/delete/local/:filename", desc: "Delete a local email JSON file", enabled: true, category: "Local Console", hits: 0 },
  { id: "delete-live", method: "POST", path: "/api/emails/delete/live/:filename", desc: "Delete a live email JSON file", enabled: true, category: "Live Console", hits: 0 },
  { id: "send-local", method: "POST", path: "/api/send-email/local", desc: "Dispatch email locally on SMTP Port 2525", enabled: true, category: "Local Console", hits: 0 },
  { id: "send-live", method: "POST", path: "/api/send-email/live", desc: "Dispatch email publicly using validated relay", enabled: true, category: "Live Console", hits: 0 },
  { id: "admin-login", method: "POST", path: "/api/admin/login", desc: "Authenticate admin dashboard session credentials", enabled: true, category: "Admin Management", hits: 0 },
  { id: "admin-stats", method: "GET", path: "/api/admin/stats", desc: "Get server metrics, disk sizes, and account totals", enabled: true, category: "Admin Management", hits: 0 },
  { id: "admin-credentials", method: "GET/POST/DELETE", path: "/api/admin/credentials", desc: "Manage outbound SMTP relay credentials configuration", enabled: true, category: "Admin Management", hits: 0 }
];

/**
 * Controller class to handle all admin actions
 */
export class AdminController {
  
  /**
   * Validates credentials for Admin Dashboard
   * Login with: admin / 1234
   */
  static login(req, res) {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => {
      try {
        const { email, username, password } = JSON.parse(body);
        const loginName = username || email;
        const adminPass = process.env.ADMIN_PASSWORD || "1234";

        if ((loginName === "admin" || loginName === "admin@gmail.com") && password === adminPass) {
          const token = Buffer.from(`admin:${adminPass}`).toString("base64");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, token }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Incorrect credentials" }));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
  }

  /**
   * Helper to retrieve all API Settings (routes, descriptions, hits)
   */
  static getApiSettings(req, res) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(apiSettings));
  }

  /**
   * Helper to toggle API route activation
   */
  static toggleApiSetting(req, res) {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => {
      try {
        const { id, enabled } = JSON.parse(body);
        const api = apiSettings.find(a => a.id === id);
        if (api) {
          api.enabled = enabled;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, api }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API setting not found" }));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
  }

  /**
   * Middleware check to verify if a request route is enabled
   */
  static isApiEnabled(url, method) {
    const cleanUrl = url.split("?")[0];
    
    // Always allow configuration APIs to remain active
    if (cleanUrl === "/api/admin/api-settings" || cleanUrl === "/api/admin/api-settings/toggle") {
      return true;
    }
    
    // Find matching API config
    const api = apiSettings.find(a => {
      // Direct path match
      if (a.path === cleanUrl) return true;
      
      // Dynamic pattern matches:
      if (a.id === "mailbox-get" && cleanUrl.startsWith("/api/mailbox/") && !cleanUrl.endsWith("/otps") && method === "GET") {
        const parts = cleanUrl.split("/");
        return parts.length === 4; // /api/mailbox/user@domain.com
      }
      if (a.id === "mailbox-otps" && cleanUrl.startsWith("/api/mailbox/") && cleanUrl.endsWith("/otps") && method === "GET") {
        return true;
      }
      if (a.id === "mailbox-delete" && cleanUrl.startsWith("/api/mailbox/") && method === "DELETE") {
        return true;
      }
      if (a.id === "delete-local" && cleanUrl.startsWith("/api/emails/delete/local/") && method === "POST") return true;
      if (a.id === "delete-live" && cleanUrl.startsWith("/api/emails/delete/live/") && method === "POST") return true;
      
      // Match logs
      if (a.id === "local-emails" && cleanUrl.startsWith("/api/logs/local") && method === "GET") return true;
      if (a.id === "live-emails" && cleanUrl.startsWith("/api/logs/live") && method === "GET") return true;
      
      return false;
    });

    if (api) {
      if (!api.enabled) {
        return false;
      }
      api.hits++; // Increment usage statistics count
    }
    return true;
  }

  /**
   * Retrieves statistics for the dashboard panels
   */
  static getStats(req, res) {
    try {
      const localFiles = fs.existsSync(localMailDir) ? fs.readdirSync(localMailDir).filter(f => f.endsWith(".json")).length : 0;
      const liveFiles = fs.existsSync(liveMailDir) ? fs.readdirSync(liveMailDir).filter(f => f.endsWith(".json")).length : 0;
      
      // Calculate disk sizes
      let diskBytes = 0;
      const directories = [localMailDir, liveMailDir, attachmentsDir];
      directories.forEach(dir => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const stats = fs.statSync(path.join(dir, file));
            diskBytes += stats.size;
          });
        }
      });

      // Calculate unique active mailboxes (recipient addresses)
      const activeMailboxes = new Set();
      const readMailboxes = (dir) => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
          files.forEach(file => {
            try {
              const fileContent = fs.readFileSync(path.join(dir, file), "utf-8");
              const parsed = JSON.parse(fileContent);
              activeMailboxes.add(extractEmail(parsed.to));
            } catch (e) {}
          });
        }
      };
      readMailboxes(localMailDir);
      readMailboxes(liveMailDir);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        totalEmails: localFiles + liveFiles,
        localEmailsCount: localFiles,
        liveEmailsCount: liveFiles,
        diskUsageBytes: diskBytes,
        activeMailboxesCount: activeMailboxes.size,
        liveModeActive: process.env.live !== "false"
      }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Returns list of SMTP Relay user credentials
   */
  static getCredentials(req, res) {
    try {
      if (!fs.existsSync(credsPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }
      
      const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(creds.users || []));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Adds or updates SMTP Relay credentials
   */
  static addCredential(req, res) {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Username and password are required" }));
          return;
        }

        let creds = { users: [] };
        if (fs.existsSync(credsPath)) {
          creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        }

        // Delete if username exists to prevent duplicates
        creds.users = creds.users.filter(u => u.username !== username);
        creds.users.push({ username, password });

        fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), "utf-8");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  /**
   * Removes SMTP Relay user credentials
   */
  static deleteCredential(req, res, username) {
    if (!username) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Username parameter is required" }));
      return;
    }

    try {
      if (!fs.existsSync(credsPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Credentials file not found" }));
        return;
      }

      const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      const originalCount = creds.users.length;
      creds.users = creds.users.filter(u => u.username !== username);

      if (creds.users.length === originalCount) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Username not found" }));
        return;
      }

      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}
