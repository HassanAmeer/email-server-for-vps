import fs from "fs";
import path from "path";
import { AdminController } from "../backend/admin/admin-controller.js";

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
  
  /**
   * GET /api/mailbox/generate
   * Generates a random temporary email address
   */
  static generateMailbox(req, res) {
    const domain = process.env.DOMAIN || "llamerada.online";
    const randomString = Math.random().toString(36).substring(2, 10);
    const email = `${randomString}@${domain}`;
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ email }));
  }

  /**
   * GET /api/mailbox/:email
   * Fetches all emails received for the specified mailbox
   */
  static getMailbox(req, res, emailAddress) {
    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }

      const files = fs.readdirSync(targetDir).filter(file => file.endsWith(".json"));
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
    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }

      const files = fs.readdirSync(targetDir).filter(file => file.endsWith(".json"));
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
    if (!emailAddress) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing email address parameter" }));
      return;
    }

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: 0 }));
        return;
      }

      const files = fs.readdirSync(targetDir).filter(file => file.endsWith(".json"));
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(fileContent);
        
        const cleanRecipient = extractEmail(parsed.to);
        const targetRecipient = emailAddress.toLowerCase().trim();

        if (cleanRecipient === targetRecipient || cleanRecipient.includes(targetRecipient)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
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
    if (!emailAddress || !mailId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing emailAddress or mailId parameter" }));
      return;
    }

    try {
      const targetDir = getTargetStorageDir();
      if (!fs.existsSync(targetDir)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Mailbox not found" }));
        return;
      }

      const files = fs.readdirSync(targetDir).filter(file => file.endsWith(".json"));
      let deleted = false;

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(fileContent);

        const cleanRecipient = extractEmail(parsed.to);
        const targetRecipient = emailAddress.toLowerCase().trim();

        if (parsed.id === mailId && (cleanRecipient === targetRecipient || cleanRecipient.includes(targetRecipient))) {
          fs.unlinkSync(filePath);
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
}
