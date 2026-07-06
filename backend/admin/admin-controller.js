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

/**
 * Controller class to handle all admin actions
 */
export class AdminController {
  
  /**
   * Validates credentials for Admin Dashboard
   * Login with: admin@gmail.com / 1234
   */
  static login(req, res) {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => {
      try {
        const { email, password } = JSON.parse(body);
        const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
        const adminPass = process.env.ADMIN_PASSWORD || "1234";

        if ((email === adminEmail || email === "admin") && password === adminPass) {
          const token = Buffer.from(`${adminEmail}:${adminPass}`).toString("base64");
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
