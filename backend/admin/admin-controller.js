import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import dns from "dns";
import db, {
  initApiSettings,
  getApiSettingsList,
  toggleApiSettingDB,
  incrementApiHits,
  resetApiSettingsHits,
  getSetting,
  setSetting,
  getMailboxUsers,
  createMailboxUser,
  deleteMailboxUser,
} from "../database/db.js";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateSessionToken(role, secret, durationMs = SESSION_DURATION_MS) {
  const expiresAt = Date.now() + durationMs;
  const payload = `${role}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret || "session_secret_key").update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifySessionToken(token, expectedRole, secret) {
  try {
    if (!token || typeof token !== "string") return false;
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [role, expiresAtStr, hmac] = parts;
    if (role !== expectedRole) return false;
    const expiresAt = Number(expiresAtStr);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false; // Expired
    const expectedHmac = crypto.createHmac("sha256", secret || "session_secret_key").update(`${role}:${expiresAtStr}`).digest("hex");
    if (hmac.length !== expectedHmac.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

// Paths config
const storageDir = path.join(process.cwd(), "backend", "storage");
const localMailDir = path.join(process.cwd(), "backend", "storage", "local");
const liveMailDir = path.join(process.cwd(), "backend", "storage", "live");
const attachmentsDir = path.join(process.cwd(), "backend", "storage", "media-mails");
const maildirDir = path.join(process.cwd(), "backend", "storage", "maildir");
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

// Generate today's date candidates in common formats (secret static login: dev + today's date)
function isTodaysDate(input) {
  if (!input) return false;
  const value = String(input).trim().toLowerCase();
  
  const dates = [new Date()];
  const utcDate = new Date();
  dates.push(utcDate);

  const candidates = new Set();

  for (const now of dates) {
    const pad = (n) => String(n).padStart(2, "0");
    const d = String(now.getDate());
    const dd = pad(now.getDate());
    const m = String(now.getMonth() + 1);
    const mm = pad(now.getMonth() + 1);
    const yyyy = String(now.getFullYear());
    const yy = yyyy.slice(-2);

    // Day only (e.g. "19", "09")
    candidates.add(d);
    candidates.add(dd);
    candidates.add(`dev${d}`);
    candidates.add(`dev${dd}`);

    // Day + Month
    candidates.add(`${dd}${mm}`);
    candidates.add(`${dd}-${mm}`);
    candidates.add(`${dd}/${mm}`);
    candidates.add(`${d}${m}`);

    // Full Date formats
    candidates.add(`${dd}-${mm}-${yyyy}`);
    candidates.add(`${dd}/${mm}/${yyyy}`);
    candidates.add(`${dd}.${mm}.${yyyy}`);
    candidates.add(`${yyyy}-${mm}-${dd}`);
    candidates.add(`${yyyy}/${mm}/${dd}`);
    candidates.add(`${yyyy}.${mm}.${dd}`);
    candidates.add(`${mm}-${dd}-${yyyy}`);
    candidates.add(`${mm}/${dd}/${yyyy}`);
    candidates.add(`${dd}${mm}${yyyy}`);
    candidates.add(`${yyyy}${mm}${dd}`);
    candidates.add(`${dd}-${mm}-${yy}`);
    candidates.add(`${dd}/${mm}/${yy}`);
    candidates.add(`${dd}${mm}${yy}`);

    // Also with dev prefix
    candidates.add(`dev${dd}${mm}${yyyy}`);
    candidates.add(`dev${dd}`);
  }

  return candidates.has(value);
}

// Available APIs config list with category and stats
export const defaultApiSettings = [
  { id: "api-domains", method: "GET", path: "/api/domains", desc: "Active Domains List: Fetch all active domains available for generating temporary emails.", enabled: true, category: "Mailbox UI", hits: 0, auth: false, variables: "None" },
  { id: "mailbox-generate", method: "GET", path: "/api/mailbox/generate", desc: "Generate Random Mailbox: Dynamically allocate a random temporary email address on any active domain.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "?domain=example.com (Optional)" },
  { id: "mailbox-custom", method: "GET", path: "/api/mailbox/custom", desc: "Create Custom Mailbox: Create custom username mailbox (letters, numbers, dots, hyphens).", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "?name=username&domain=example.com" },
  { id: "mailbox-get", method: "GET", path: "/api/mailbox/:email", desc: "Get Inbound Emails: Retrieve captured emails, sender info, body text, HTML, and attachments.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email" },
  { id: "mailbox-otps", method: "GET", path: "/api/mailbox/:email/otps", desc: "Extract OTP Codes: Scan mailbox emails and extract 4-6 digit numeric OTP verification codes.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email" },
  { id: "get-attachment", method: "GET", path: "/api/attachments/:filename", desc: "Download Attachment: Stream raw binary payload of a saved email attachment.", enabled: true, category: "Mailbox UI", hits: 0, auth: false, variables: "Params: :filename" },
  { id: "mailbox-delete", method: "DELETE", path: "/api/mailbox/:email", desc: "Purge Mailbox: Delete entire mailbox storage history and all captured messages.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email" },
  { id: "mailbox-delete-one", method: "DELETE", path: "/api/mailbox/:email/:mailId", desc: "Delete Single Email: Delete a specific email message from mailbox database.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email, :mailId" },
  
  // Local & Live Consoles
  { id: "local-emails", method: "GET", path: "/api/emails/local", desc: "Local Console Emails: Fetch local inbox emails and internal SMTP Port 2525 traffic logs.", enabled: true, category: "Local Console", hits: 0, auth: true, variables: "None" },
  { id: "live-emails", method: "GET", path: "/api/emails/live", desc: "Live Console Emails: Fetch live inbox emails and live public SMTP Port 25 traffic logs.", enabled: true, category: "Live Console", hits: 0, auth: true, variables: "None" },
  { id: "delete-local", method: "POST", path: "/api/emails/delete/local/:filename", desc: "Delete Local Email: Delete a local email JSON file by filename.", enabled: true, category: "Local Console", hits: 0, auth: true, variables: "Params: :filename" },
  { id: "delete-live", method: "POST", path: "/api/emails/delete/live/:filename", desc: "Delete Live Email: Delete a live email JSON file by filename.", enabled: true, category: "Live Console", hits: 0, auth: true, variables: "Params: :filename" },
  { id: "send-local", method: "POST", path: "/api/send-email/local", desc: "Send Local Email: Dispatch test email locally on SMTP Port 2525.", enabled: true, category: "Local Console", hits: 0, auth: true, variables: "Body: JSON {from, to, subject, text, html}" },
  { id: "send-live", method: "POST", path: "/api/send-email/live", desc: "Send Live Email: Dispatch outbound email directly to any public internet address via VPS SMTP node.", enabled: true, category: "Live Console", hits: 0, auth: false, variables: "Body: JSON {from, to, subject, text, html}" },
  
  // Admin Management
  { id: "admin-login", method: "POST", path: "/api/admin/login", desc: "Admin Login: Authenticate admin dashboard session credentials.", enabled: true, category: "Admin Management", hits: 0, auth: false, variables: "Body: JSON {username, password}" },
  { id: "admin-stats", method: "GET", path: "/api/admin/stats", desc: "Server Stats: Get server metrics, disk sizes, and account totals.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-credentials", method: "GET/POST/DELETE", path: "/api/admin/credentials", desc: "Manage Credentials: Configure outbound SMTP relay credentials.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "GET/POST/DELETE variations" },
  { id: "all-mails", method: "GET", path: "/api/mails", desc: "All Inbound Emails: Combined date-sorted feed of all Live & Local emails with pagination.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-projects", method: "GET/POST", path: "/api/admin/projects", desc: "Manage Projects: List active projects or create new project with isolated API keys.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-projects-update", method: "PUT/DELETE", path: "/api/admin/projects/:id", desc: "Update/Delete Project: Edit project configuration, webhook URL, or remove project by ID.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-emails", method: "GET", path: "/api/admin/projects/:id/emails", desc: "Project Emails: Fetch paginated emails scoped to a specific project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-files", method: "GET", path: "/api/admin/projects/:id/files", desc: "Project Files & Media: List files and attachments stored for a project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-hits", method: "DELETE", path: "/api/admin/projects/:id/hits", desc: "Reset Project Hits: Reset API traffic usage statistics for a project to zero.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-retention", method: "PUT", path: "/api/admin/projects/:id/retention", desc: "Data Retention Limits: Configure auto-cleanup retention hours for disk files.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-domains", method: "GET/POST", path: "/api/admin/domains", desc: "Manage Domains: List and attach custom domains for email generation.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-domains-update", method: "PUT/DELETE", path: "/api/admin/domains/:id", desc: "Update/Delete Domain: Edit domain status or remove domain from server.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "api-settings", method: "GET", path: "/api/admin/api-settings", desc: "Get API Settings: Retrieve status, categories, and hit counts for all routes.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "api-settings-toggle", method: "POST", path: "/api/admin/api-settings/toggle", desc: "Toggle API Route: Dynamically enable or disable specific API endpoints.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {id, enabled}" },
  { id: "api-settings-reset", method: "POST", path: "/api/admin/api-settings/reset-hits", desc: "Reset All Hits: Purge global aggregate traffic statistics for all APIs.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-seed", method: "GET/POST", path: "/api/admin/seed", desc: "Seed Mock Data: Seed demo emails, logs, and 7-day traffic analytics.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "GET /status or POST Body: JSON {action, count, domain, projectId}" },
  
  // Mailbox Client APIs (for permanent mailbox users & master inbox via third-party apps)
  { id: "mailbox-client-info", method: "GET", path: "/api/mailbox/info", desc: "Mailbox Server Info: Retrieve Primary Domain info, IMAP/POP3 hostnames, and ports (993/143).", enabled: true, category: "Mailbox Client", hits: 0, auth: false, variables: "None" },
  { id: "mailbox-client-login", method: "POST", path: "/api/mailbox/login", desc: "Mailbox User Login: Authenticate mailbox account and receive Bearer token.", enabled: true, category: "Mailbox Client", hits: 0, auth: false, variables: "Body: JSON {email, password}" },
  { id: "mailbox-client-inbox", method: "GET", path: "/api/mailbox/inbox", desc: "Mailbox Inbox: Retrieve paginated inbox messages for authenticated user.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "?page=1&limit=200&filter=all&search=keyword" },
  { id: "mailbox-client-count", method: "GET", path: "/api/mailbox/count", desc: "Unread Message Count: Get total messages count for badge notifications.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "None" },
  { id: "mailbox-client-read", method: "GET", path: "/api/mailbox/inbox/:id", desc: "Read Message: Fetch full parsed HTML sandbox, text body, and metadata.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "Params: :id" },
  { id: "mailbox-client-delete", method: "DELETE", path: "/api/mailbox/inbox/:id", desc: "Delete Mailbox Message: Permanently delete specific email from storage.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "Params: :id" },
  { id: "mailbox-client-media", method: "GET", path: "/api/mailbox/media", desc: "Mailbox Media Files: List all media files and attachments for user.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "None" },
  { id: "mailbox-client-send", method: "POST", path: "/api/mailbox/send", desc: "Send Mailbox Email: Dispatch outbound email from authenticated mailbox address via SMTP node.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "Body: JSON {to, subject, message}" },

  // SMTP Relay & Outbound Email APIs (for Admin & DevPanel)
  { id: "smtp-list", method: "GET", path: "/api/admin/smtp", desc: "List SMTP Accounts: Fetch all configured SMTP addresses, domains & credentials.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "None" },
  { id: "smtp-create", method: "POST", path: "/api/admin/smtp", desc: "Create SMTP Account: Generate new SMTP address using active domains list (/api/domains).", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {email, password, domain, description}" },
  { id: "smtp-send", method: "POST", path: "/api/admin/smtp/send", desc: "Send Single / Test Email: Dispatch outbound email with DKIM signature, HTML body & attachments.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {from, to, subject, text, html, attachments}" },
  { id: "smtp-send-bulk", method: "POST", path: "/api/admin/smtp/send-bulk", desc: "Send Bulk Emails (5s Delay): Sequentially dispatch emails to multiple recipients with 5s delay.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {from, recipients: [...], subject, text, html, delaySeconds: 5}" },
  { id: "smtp-test", method: "POST", path: "/api/admin/smtp/test", desc: "Test SMTP Relay: Verify outbound email transmission check to any destination mailbox.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {toEmail, fromEmail, subject, text}" },
  { id: "smtp-delete", method: "DELETE", path: "/api/admin/smtp/:identifier", desc: "Delete SMTP Account: Permanently delete an SMTP account by account ID or Email address.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Params: :identifier (ID or Email)" }
];

// Default Admin Sidebar Menu Tabs configuration
export const DEFAULT_ADMIN_MENU = [
  {
    id: "overview-tab",
    tab: "overview-tab",
    path: "overview",
    label: "Overview",
    desc: "System telemetry, disk storage volume, and live server health monitoring.",
    category: "Core",
    enabled: true,
  },
  {
    id: "domains-tab",
    tab: "domains-tab",
    path: "domains",
    label: "Domains",
    desc: "Custom domain records, DNS MX/SPF verification, and catch-all rules.",
    category: "Management",
    enabled: true,
  },
  {
    id: "primary-domain-tab",
    tab: "primary-domain-tab",
    path: "primary-domain",
    label: "Primary Domain",
    desc: "Primary domain configuration, webmail management, and user mailboxes.",
    category: "Management",
    enabled: true,
  },
  {
    id: "projects-tab",
    tab: "projects-tab",
    path: "projects",
    label: "Projects",
    desc: "Manage developer projects, API keys, webhook URLs, and data retention.",
    category: "Management",
    enabled: true,
  },
  {
    id: "smtp-tab",
    tab: "smtp-tab",
    path: "smtp",
    label: "SMTP Relay",
    desc: "Configure outbound SMTP credentials, domain routing, and app integration keys.",
    category: "Core",
    enabled: true,
  },
  {
    id: "api-tab",
    tab: "api-tab",
    path: "apisetting",
    label: "API Settings",
    desc: "API endpoint status, rate limiting, and route toggles.",
    category: "Core",
    enabled: true,
  },
  {
    id: "logs-tab",
    tab: "logs-tab",
    path: "logs",
    label: "Live Logs",
    desc: "Real-time stream of inbound and outbound SMTP email transaction logs.",
    category: "Monitoring",
    enabled: true,
  },
];

// Initialize settings in database
initApiSettings(defaultApiSettings);

// Safe async request body reader
async function parseJsonBody(req) {
  let body = "";
  await new Promise((resolve) => {
    req.on("data", chunk => body += chunk.toString());
    req.on("end", resolve);
    req.on("error", resolve);
    if (req.readableEnded) resolve();
  });
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (e) {
    return null;
  }
}

/**
 * Controller class to handle all admin actions
 */
export class AdminController {

  static get adminToken() {
    const adminPass = process.env.ADMIN_PASSWORD || "1234";
    return Buffer.from(`admin:${adminPass}`).toString("base64");
  }

  static get devPanelToken() {
    const devPass = process.env.DEVPANEL_PASSWORD || process.env.DEV_ADMIN_PASSWORD || "devpass";
    return Buffer.from(`devpanel:${devPass}`).toString("base64");
  }

  static get devAdminToken() {
    const devPass = process.env.DEVPANEL_PASSWORD || process.env.DEV_ADMIN_PASSWORD || "devpass";
    return Buffer.from(`devpanel:${devPass}`).toString("base64");
  }

  /**
   * Validates if a token is a valid Admin token (either static master token or 24h signed token)
   */
  static isValidAdminToken(token) {
    if (!token) return false;
    const adminPass = process.env.ADMIN_PASSWORD || "1234";
    // 1. Check static master token (backward compatibility for direct API keys & integrations)
    if (token === AdminController.adminToken) return true;
    // 2. Check 24-hour signed session token
    return verifySessionToken(token, "admin", adminPass);
  }

  /**
   * Validates if a token is a valid DevPanel / DevAdmin token (or master admin token)
   */
  static isValidDevToken(token) {
    if (!token) return false;
    const devPass = process.env.DEVPANEL_PASSWORD || process.env.DEV_ADMIN_PASSWORD || "devpass";
    const adminPass = process.env.ADMIN_PASSWORD || "1234";
    // 1. Check master admin token
    if (AdminController.isValidAdminToken(token)) return true;
    // 2. Check static dev tokens
    if (token === AdminController.devPanelToken || token === AdminController.devAdminToken) return true;
    // 3. Check 24-hour signed session tokens for devpanel or devadmin
    return verifySessionToken(token, "devpanel", devPass) || verifySessionToken(token, "devadmin", devPass);
  }

  /**
   * Validates credentials for Admin Dashboard
   * Login with: admin / 1234 -> Generates 24-Hour session token
   */
  static async login(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (parsed === null) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { email, username, password } = parsed;
      const loginName = String(username || email || "").toLowerCase().trim();
      const adminPass = process.env.ADMIN_PASSWORD || "1234";

      if ((loginName === "admin" || loginName === "admin@gmail.com") && password === adminPass) {
        const token = generateSessionToken("admin", adminPass, SESSION_DURATION_MS);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          success: true, 
          token, 
          expiresIn: 86400, 
          expiresAt: Date.now() + SESSION_DURATION_MS 
        }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Incorrect admin credentials" }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * DevPanel login — auth for the developer panel -> Generates 24-Hour session token
   * Allows: username "dev", "devpanel", "devadmin" with DEVPANEL_PASSWORD or today's date
   */
  static async devPanelLogin(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (parsed === null) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { email, username, password } = parsed;
      const loginName = String(username || email || "").toLowerCase().trim();
      const devPass = process.env.DEVPANEL_PASSWORD || process.env.DEV_ADMIN_PASSWORD || "devpass";

      if ((loginName === "dev" || loginName === "devpanel" || loginName === "devadmin") && (password === devPass || isTodaysDate(password))) {
        const token = generateSessionToken("devpanel", devPass, SESSION_DURATION_MS);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          success: true, 
          token, 
          staticLogin: isTodaysDate(password),
          expiresIn: 86400, 
          expiresAt: Date.now() + SESSION_DURATION_MS 
        }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Incorrect developer credentials (Use username: dev)" }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static async devAdminLogin(req, res) {
    return AdminController.devPanelLogin(req, res);
  }

  static getApiSettings(req, res) {
    const isDevScope = (req.url && (req.url.startsWith("/api/devpanel") || req.url.startsWith("/api/dev-admin") || req.url.startsWith("/api/dev"))) ||
                       (req.headers && req.headers["x-scope"] === "devpanel");

    const list = getApiSettingsList();
    // Merge static fields (auth, variables) that aren't stored in DB
    const enrichedList = list.map(item => {
      const staticData = defaultApiSettings.find(s => s.id === item.id);
      let itemPath = item.path;
      let itemCategory = item.category;

      if (isDevScope) {
        if (itemPath.startsWith("/api/admin/")) {
          itemPath = itemPath.replace("/api/admin/", "/api/devpanel/");
          itemCategory = "DevPanel Management";
        } else if (itemPath.startsWith("/api/")) {
          itemPath = itemPath.replace("/api/", "/api/dev/");
          itemCategory = itemCategory === "Mailbox UI" ? "Dev Mailbox UI" :
                         itemCategory === "Mailbox Client" ? "Dev Master Mailbox" :
                         itemCategory === "Local Console" ? "Dev Local Console" :
                         itemCategory === "Live Console" ? "Dev Live Console" : `Dev ${itemCategory}`;
        }
      }

      return {
        ...item,
        path: itemPath,
        category: itemCategory,
        auth: staticData ? staticData.auth : false,
        variables: staticData ? staticData.variables : "None"
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(enrichedList));
  }

  /**
   * Helper to toggle API route activation
   */
  static async toggleApiSetting(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { id, enabled } = parsed;
      const success = toggleApiSettingDB(id, enabled);
      if (success) {
        const list = getApiSettingsList();
        const api = list.find(a => a.id === id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, api }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "API setting not found" }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static resetApiSettingsHits(req, res) {
    try {
      resetApiSettingsHits();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reset API hits" }));
    }
  }

  /**
   * Retrieves the current Admin Sidebar Menu configuration
   */
  static getAdminMenuConfig(req, res) {
    try {
      const raw = getSetting("admin_sidebar_menu_config");
      let storedList = [];
      if (raw) {
        try {
          storedList = JSON.parse(raw);
        } catch (e) {}
      }

      const merged = DEFAULT_ADMIN_MENU.map(defaultItem => {
        const found = Array.isArray(storedList) ? storedList.find(s => s.id === defaultItem.id || s.tab === defaultItem.tab) : null;
        return {
          ...defaultItem,
          enabled: found ? Boolean(found.enabled) : defaultItem.enabled,
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, menu: merged }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Toggles or updates an Admin Sidebar Menu item (Accessible via DevPanel / SuperAdmin)
   */
  static async toggleAdminMenuItem(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed || !parsed.id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing menu tab id" }));
        return;
      }

      const raw = getSetting("admin_sidebar_menu_config");
      let storedList = [];
      if (raw) {
        try {
          storedList = JSON.parse(raw);
        } catch (e) {}
      }

      const merged = DEFAULT_ADMIN_MENU.map(defaultItem => {
        const found = Array.isArray(storedList) ? storedList.find(s => s.id === defaultItem.id || s.tab === defaultItem.tab) : null;
        let isEnabled = found ? Boolean(found.enabled) : defaultItem.enabled;
        if (defaultItem.id === parsed.id || defaultItem.tab === parsed.id || defaultItem.path === parsed.id) {
          isEnabled = typeof parsed.enabled === "boolean" ? parsed.enabled : !isEnabled;
        }
        return {
          ...defaultItem,
          enabled: isEnabled,
        };
      });

      setSetting("admin_sidebar_menu_config", JSON.stringify(merged));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, menu: merged }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Resets Admin Sidebar Menu configuration to defaults
   */
  static resetAdminMenuConfig(req, res) {
    try {
      setSetting("admin_sidebar_menu_config", JSON.stringify(DEFAULT_ADMIN_MENU));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, menu: DEFAULT_ADMIN_MENU }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static isApiEnabled(url, method) {
    const cleanUrl = url.split("?")[0];

    // Always allow configuration & login APIs to remain active
    if (cleanUrl === "/api/admin/api-settings" || cleanUrl === "/api/admin/api-settings/toggle" ||
        cleanUrl === "/api/devpanel/api-settings" || cleanUrl === "/api/devpanel/api-settings/toggle" ||
        cleanUrl === "/api/dev-admin/api-settings" || cleanUrl === "/api/dev-admin/api-settings/toggle" ||
        cleanUrl === "/api/dev/api-settings" || cleanUrl === "/api/dev/api-settings/toggle" ||
        cleanUrl === "/api/admin/login" || cleanUrl === "/api/devpanel/login" || cleanUrl === "/api/dev-admin/login" || cleanUrl === "/api/dev/login" ||
        cleanUrl === "/api/mailbox/login" || cleanUrl === "/api/dev/mailbox/login") {
      return true;
    }

    const normUrl = cleanUrl.replace(/^\/api\/devpanel\//, "/api/admin/").replace(/^\/api\/dev-admin\//, "/api/admin/").replace(/^\/api\/dev\//, "/api/");

    const list = getApiSettingsList();
    // Find matching API config
    const api = list.find(a => {
      // Direct path match
      if (a.path === cleanUrl || a.path === normUrl) return true;

      // Dynamic pattern matches:
      if (a.id === "api-domains" && (normUrl === "/api/domains" || cleanUrl === "/api/domains") && method === "GET") {
        return true;
      }
      if (a.id === "mailbox-get" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && !cleanUrl.endsWith("/otps") && method === "GET") {
        const parts = normUrl.split("/");
        return parts.length === 4; // /api/mailbox/user@domain.com
      }
      if (a.id === "mailbox-otps" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && cleanUrl.endsWith("/otps") && method === "GET") {
        return true;
      }
      if (a.id === "mailbox-delete-one" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && method === "DELETE") {
        const parts = normUrl.split("/");
        return parts.length === 5;
      }
      if (a.id === "mailbox-delete" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && method === "DELETE") {
        const parts = normUrl.split("/");
        return parts.length === 4;
      }
      if (a.id === "delete-local" && (normUrl.startsWith("/api/emails/delete/local/") || cleanUrl.startsWith("/api/emails/delete/local/")) && method === "POST") return true;
      if (a.id === "delete-live" && (normUrl.startsWith("/api/emails/delete/live/") || cleanUrl.startsWith("/api/emails/delete/live/")) && method === "POST") return true;

      // Match logs
      if (a.id === "local-emails" && (normUrl.startsWith("/api/logs/local") || cleanUrl.startsWith("/api/logs/local")) && method === "GET") return true;
      if (a.id === "live-emails" && (normUrl.startsWith("/api/logs/live") || cleanUrl.startsWith("/api/logs/live")) && method === "GET") return true;

      return false;
    });

    if (api) {
      if (!api.enabled) {
        return false;
      }
      incrementApiHits(api.id); // Increment usage statistics count
    }
    return true;
  }

  /**
   * Retrieves statistics for the dashboard panels
   */
  static getStats(req, res) {
    try {
      const scope = (req.url && (req.url.startsWith("/api/devpanel") || req.url.startsWith("/api/dev-admin") || req.url.startsWith("/api/dev")))
        ? "devadmin"
        : (req.headers && (req.headers["x-scope"] === "devpanel" || req.headers["x-scope"] === "devadmin") ? "devadmin" : "admin");

      const localFiles = fs.existsSync(localMailDir) ? fs.readdirSync(localMailDir).filter(f => f.endsWith(".json")).length : 0;
      const liveFiles = fs.existsSync(liveMailDir) ? fs.readdirSync(liveMailDir).filter(f => f.endsWith(".json")).length : 0;

      // Calculate disk sizes across storage directories
      let diskBytes = 0;
      const directories = [localMailDir, liveMailDir, attachmentsDir, storageDir];
      directories.forEach(dir => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            try {
              const fileStat = fs.statSync(path.join(dir, file));
              if (fileStat.isFile()) {
                diskBytes += fileStat.size;
              }
            } catch (e) {}
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
            } catch (e) { }
          });
        }
      };
      readMailboxes(localMailDir);
      readMailboxes(liveMailDir);

      // Inbound / Received emails count
      let receivedCount = localFiles + liveFiles;
      try {
        const dbRec = db.prepare("SELECT COUNT(*) as count FROM received_emails WHERE is_deleted = 0").get();
        if (dbRec && dbRec.count > receivedCount) {
          receivedCount = dbRec.count;
        }
        if (receivedCount === 0) {
          const sysRec = db.prepare("SELECT COUNT(*) as count FROM system_logs WHERE log_type = 'RECEIVE'").get();
          receivedCount = sysRec?.count || 0;
        }
      } catch (e) {}

      // Attached Domains & Primary Domain scoped
      let domainsCount = 0;
      let primaryDomain = "";
      let primaryDomainsCount = 0;
      let activeDomainsCount = 0;
      let pausedDomainsCount = 0;
      try {
        const dCount = db.prepare("SELECT COUNT(*) as count FROM attached_domains WHERE scope = ?").get(scope);
        domainsCount = dCount?.count || 0;
        const pRow = db.prepare("SELECT domain FROM attached_domains WHERE scope = ? AND is_primary = 1 LIMIT 1").get(scope);
        if (pRow) {
          primaryDomain = pRow.domain;
          primaryDomainsCount = 1;
        } else {
          const firstActive = db.prepare("SELECT domain FROM attached_domains WHERE scope = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1").get(scope);
          if (firstActive) {
            primaryDomain = firstActive.domain;
          }
        }
        const activeRow = db.prepare("SELECT COUNT(*) as count FROM attached_domains WHERE scope = ? AND status = 'active'").get(scope);
        activeDomainsCount = activeRow?.count || 0;
        const pausedRow = db.prepare("SELECT COUNT(*) as count FROM attached_domains WHERE scope = ? AND (status = 'paused' OR status = 'inactive')").get(scope);
        pausedDomainsCount = pausedRow?.count || 0;
      } catch (e) {}

      // Outbound / Sent emails count
      let sentCount = 0;
      try {
        const sentRow = db.prepare("SELECT COUNT(*) as count FROM sent_emails WHERE scope = ? OR ? = 'all'").get(scope, scope);
        sentCount = sentRow?.count || 0;
        if (sentCount === 0) {
          const sysSent = db.prepare("SELECT COUNT(*) as count FROM system_logs WHERE log_type = 'SEND'").get();
          sentCount = sysSent?.count || 0;
        }
      } catch (e) {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        totalEmails: receivedCount,
        totalReceivedEmails: receivedCount,
        localEmailsCount: localFiles,
        liveEmailsCount: liveFiles,
        domainsCount: domainsCount,
        attachedDomainsCount: domainsCount,
        primaryDomain: primaryDomain || "None configured",
        primaryDomainsCount: primaryDomainsCount,
        activeDomainsCount: activeDomainsCount,
        pausedDomainsCount: pausedDomainsCount,
        diskUsageBytes: diskBytes,
        totalSentEmails: sentCount,
        sentEmailsCount: sentCount,
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
      const enrichedUsers = (creds.users || []).map((u, idx) => ({
        id: u.id || `smtp_${Buffer.from(u.username || `user_${idx}`).toString("hex").substring(0, 8)}`,
        ...u
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(enrichedUsers));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Adds or updates SMTP Relay credentials
   */
  static async addCredential(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      let { id, username, password, domain, fromEmail, email, description } = parsed;
      
      const finalEmail = email?.trim() || fromEmail?.trim() || username?.trim() || "";
      if (!finalEmail && !username) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Email or username is required" }));
        return;
      }

      if (!username) {
        username = finalEmail;
      }
      if (!password) {
        // Generate random secure password if omitted
        password = "smtp_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
      }

      let creds = { users: [] };
      if (fs.existsSync(credsPath)) {
        try {
          creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        } catch (e) {
          creds = { users: [] };
        }
      }
      if (!Array.isArray(creds.users)) creds.users = [];

      const existingUser = creds.users.find(u => 
        (id && u.id === id) || 
        u.username === username.trim() || 
        (u.email && u.email.toLowerCase() === finalEmail.toLowerCase())
      );

      const userObj = {
        id: id || existingUser?.id || `smtp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: finalEmail || username.trim(),
        username: username.trim(),
        password: password.trim(),
        domain: domain?.trim() || (finalEmail.includes("@") ? finalEmail.split("@")[1] : "*"),
        fromEmail: fromEmail?.trim() || finalEmail || username.trim(),
        description: description?.trim() || "Web App / Website SMTP Relay",
        created_at: existingUser?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Filter out previous version by id OR username OR email
      creds.users = creds.users.filter(u => 
        u.username !== username.trim() && 
        (!u.id || u.id !== userObj.id) &&
        (!u.email || u.email.toLowerCase() !== userObj.email.toLowerCase())
      );
      creds.users.push(userObj);

      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "SMTP credential saved successfully", credential: userObj }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Dispatches an outbound email via REST API using SMTP/DKIM pipeline
   */
  static async sendMailViaApi(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        return;
      }
      const to = parsed.to || parsed.toEmail || parsed.recipient;
      const from = parsed.from || parsed.fromEmail || parsed.sender || "noreply@micorna.biz";
      const subject = parsed.subject || "Notification";
      const text = parsed.text || parsed.message || parsed.body || "";
      const html = parsed.html || "";
      const attachments = parsed.attachments || [];

      if (!to) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Recipient email ('to' or 'toEmail') is required." }));
        return;
      }

      const IS_LIVE = process.env.live !== "false";
      let result;
      if (IS_LIVE) {
        const { sendOutboundEmail } = await import("../send-mail-simple/send-mail-from-generated-mail-from-live.js");
        result = await sendOutboundEmail({
          from,
          to,
          subject,
          text: text || (html ? "" : "No text content"),
          html: html || undefined,
          attachments: Array.isArray(attachments) ? attachments : []
        });
      } else {
        const { sendOutboundEmail } = await import("../send-mail-simple/send-mail-from-generated-mail-from-local.js");
        result = await sendOutboundEmail({
          from,
          to,
          subject,
          text: text || (html ? "" : "No text content"),
          html: html || undefined,
          attachments: Array.isArray(attachments) ? attachments : []
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: `Email dispatched successfully from ${from} to ${to}`,
        result
      }));
    } catch (err) {
      console.error("[REST SMTP SEND ERROR]", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  /**
   * Dispatches bulk outbound emails sequentially with enforced minimum 5-second delay
   */
  static async sendBulkMailViaApi(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        return;
      }

      let recipients = parsed.recipients || parsed.to || parsed.emails;
      if (typeof recipients === "string") {
        recipients = recipients.split(",").map(r => r.trim()).filter(Boolean);
      }
      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Recipients array ('recipients') is required." }));
        return;
      }

      const from = parsed.from || parsed.fromEmail || parsed.sender || "noreply@micorna.biz";
      const subject = parsed.subject || "Bulk Notification";
      const text = parsed.text || parsed.message || parsed.body || "";
      const html = parsed.html || "";
      const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
      
      // Enforce strict minimum 5-second delay between dispatches
      const delaySeconds = Math.max(5, Number(parsed.delaySeconds) || 5);

      const { sendOutboundEmail } = await import("../send-mail-simple/send-mail-from-generated-mail-from-live.js");

      const results = [];
      let sentCount = 0;
      let failCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i].trim();
        if (!recipient) continue;

        try {
          const result = await sendOutboundEmail({
            from,
            to: recipient,
            subject,
            text: text || (html ? "" : "No text content"),
            html: html || undefined,
            attachments
          });
          sentCount++;
          results.push({ recipient, status: "sent", messageId: result?.messageId || "sent" });
        } catch (err) {
          failCount++;
          results.push({ recipient, status: "failed", error: err.message });
        }

        // Wait minimum 5 seconds before the next email (unless it's the last email)
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: `Bulk dispatch completed. ${sentCount}/${recipients.length} emails dispatched successfully.`,
        total: recipients.length,
        sent: sentCount,
        failed: failCount,
        delaySeconds,
        results
      }));
    } catch (err) {
      console.error("[REST SMTP BULK SEND ERROR]", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  /**
   * Removes SMTP Relay user credentials by ID, email, or username
   */
  static async deleteCredential(req, res, identifier) {
    try {
      let target = identifier;

      // 1. Check query parameters (?id=... or ?email=... or ?username=...)
      if (!target && req.url && req.url.includes("?")) {
        const urlObj = new URL(req.url, "http://localhost");
        target = urlObj.searchParams.get("id") || urlObj.searchParams.get("email") || urlObj.searchParams.get("username");
      }

      // 2. Check JSON request body if present
      if (!target) {
        const parsed = await parseJsonBody(req);
        if (parsed) {
          target = parsed.id || parsed.email || parsed.username;
        }
      }

      if (!target) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "ID, email, or username parameter is required to delete SMTP account." }));
        return;
      }

      if (!fs.existsSync(credsPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Credentials file not found" }));
        return;
      }

      const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      const originalCount = (creds.users || []).length;
      const cleanTarget = decodeURIComponent(String(target).trim().toLowerCase());

      // Match by ID, username, email, or fromEmail
      creds.users = (creds.users || []).filter(u => {
        const uId = String(u.id || "").trim().toLowerCase();
        const uUser = String(u.username || "").trim().toLowerCase();
        const uEmail = String(u.email || "").trim().toLowerCase();
        const uFrom = String(u.fromEmail || "").trim().toLowerCase();

        return uId !== cleanTarget && uUser !== cleanTarget && uEmail !== cleanTarget && uFrom !== cleanTarget;
      });

      if (creds.users.length === originalCount) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: `SMTP account '${target}' not found.` }));
        return;
      }

      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), "utf-8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: `SMTP account '${target}' deleted successfully.` }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Sends a live test email via SMTP Relay
   */
  static async testSmtpRelay(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      const { toEmail, fromEmail, subject, text } = parsed || {};
      if (!toEmail) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Recipient email is required" }));
        return;
      }
      const IS_LIVE = process.env.live !== "false";
      const emailPayload = {
        from: fromEmail || "noreply@micorna.biz",
        to: toEmail,
        subject: subject || "⚡ Test Email via VPS SMTP Relay",
        text: text || "Hello! This test email was successfully dispatched through your VPS SMTP Relay Server.",
        html: `<div style="font-family:sans-serif;padding:24px;background:#0d1117;color:#fff;border-radius:12px;max-width:550px;margin:0 auto;border:1px solid #30363d;">
          <h2 style="color:#10b981;margin-top:0;">⚡ SMTP Relay Connected!</h2>
          <p style="color:#c9d1d9;line-height:1.6;">Your website/application has successfully connected to the VPS SMTP server and dispatched this message.</p>
          <div style="background:#161b22;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;color:#58a6ff;margin:16px 0;">
            Host: VPS Server<br/>
            From: ${fromEmail || "noreply@micorna.biz"}<br/>
            To: ${toEmail}<br/>
            Timestamp: ${new Date().toISOString()}
          </div>
          <p style="font-size:12px;color:#8b949e;margin-bottom:0;">DKIM signed & direct MX delivery verified.</p>
        </div>`
      };

      let result;
      if (IS_LIVE) {
        const { sendOutboundEmail } = await import("../send-mail-simple/send-mail-from-generated-mail-from-live.js");
        result = await sendOutboundEmail(emailPayload);
      } else {
        const { sendOutboundEmail } = await import("../send-mail-simple/send-mail-from-generated-mail-from-local.js");
        result = await sendOutboundEmail(emailPayload);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Retrieves the current DKIM public key
   */
  static async getDkimKey(req, res) {
    try {
      const dkimPath = path.join(process.cwd(), 'backend', 'dkim-key-for-send-mail', 'public.txt');
      
      let key = "";
      if (fs.existsSync(dkimPath)) {
        key = fs.readFileSync(dkimPath, "utf-8");
      }
      
      let ip_address = process.env.SERVER_IP || "";
      if (!ip_address) {
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipRes.json();
          ip_address = ipData.ip;
        } catch (e) {
          console.error("Could not fetch IP:", e);
          ip_address = "127.0.0.1";
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, key, ip_address }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Generates a new DKIM key pair
   */
  static generateDkimKey(req, res) {
    try {
      exec("bun backend/scripts/generate-dkim.js", (error, stdout, stderr) => {
        if (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        // Read the newly generated key
        const dkimPath = path.join(process.cwd(), 'backend', 'dkim-key-for-send-mail', 'public.txt');
        if (fs.existsSync(dkimPath)) {
          const key = fs.readFileSync(dkimPath, "utf-8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, key }));
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to read newly generated DKIM key" }));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
  /**
   * Retrieves all attached domains — optionally filtered by scope
   */
  static getAttachedDomains(req, res, scope = 'admin') {
    try {
      const domains = db.prepare("SELECT * FROM attached_domains WHERE scope = ? ORDER BY is_primary DESC, created_at DESC").all(scope);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(domains));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Sets a domain as the primary domain — scoped to admin or devadmin
   */
  static async setPrimaryAttachedDomain(req, res, id, scope = 'admin') {
    try {
      let prefix = "my";
      const parsed = await parseJsonBody(req);
      if (parsed && parsed.prefix) {
        prefix = parsed.prefix.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      }

      const exists = db.prepare("SELECT id, domain FROM attached_domains WHERE id = ? AND scope = ?").get(id, scope);
      if (!exists) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain not found" }));
        return;
      }

      db.transaction(() => {
        db.prepare("UPDATE attached_domains SET is_primary = 0 WHERE scope = ?").run(scope);
        db.prepare("UPDATE attached_domains SET is_primary = 1, primary_prefix = ? WHERE id = ? AND scope = ?").run(prefix || 'my', id, scope);

        const fullEmail = `${(prefix || 'my').trim().toLowerCase()}@${exists.domain.toLowerCase()}`;
        const existingUser = db.prepare("SELECT id FROM mailbox_table WHERE LOWER(email) = LOWER(?) OR email LIKE ?").get(fullEmail, `%@${exists.domain.toLowerCase()}`);
        if (existingUser) {
          db.prepare("UPDATE mailbox_table SET email = ? WHERE id = ?").run(fullEmail, existingUser.id);
        } else {
          const defaultPwd = "Admin@" + Math.random().toString(36).slice(-8);
          let hash = defaultPwd;
          try {
            if (typeof Bun !== "undefined" && Bun.password) {
              hash = Bun.password.hashSync(defaultPwd, { algorithm: "bcrypt", cost: 10 });
            }
          } catch (e) {}
          db.prepare("INSERT INTO mailbox_table (email, password_hash, plain_password, project_id, scope) VALUES (?, ?, ?, ?, ?)").run(fullEmail, hash, defaultPwd, 1, scope);
        }
      })();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, primary_id: id, domain: exists.domain, primary_prefix: prefix || 'my' }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Adds a new attached domain — scoped to admin or devadmin
   */
  static async addAttachedDomain(req, res, scope = 'admin') {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const { domain, status = 'pending', plan = 'free', catch_all = 1, is_primary = 0, route_to_primary = 1 } = parsed;
      if (!domain) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain name is required" }));
        return;
      }

      // If this is marked as primary, reset others in same scope only
      if (is_primary === 1 || is_primary === true) {
        db.prepare("UPDATE attached_domains SET is_primary = 0 WHERE scope = ?").run(scope);
      }

      const stmt = db.prepare("INSERT INTO attached_domains (domain, status, plan, catch_all, is_primary, route_to_primary, scope) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run(
        domain.toLowerCase().trim(),
        status,
        plan,
        catch_all === 0 || catch_all === false ? 0 : 1,
        is_primary === 1 || is_primary === true ? 1 : 0,
        route_to_primary === 0 || route_to_primary === false ? 0 : 1,
        scope
      );
      
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain is already attached" }));
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  /**
   * Updates an attached domain's status, plan, catch_all, is_primary, or route_to_primary setting
   */
  static async updateAttachedDomain(req, res, id) {
    try {
      const payload = await parseJsonBody(req);
      if (!payload || (payload.status === undefined && payload.catch_all === undefined && payload.plan === undefined && payload.is_primary === undefined && payload.route_to_primary === undefined)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No fields to update" }));
        return;
      }

      let updates = [];
      let values = [];
      
      if (payload.status !== undefined) {
        updates.push("status = ?");
        values.push(payload.status);
      }
      
      if (payload.catch_all !== undefined) {
        updates.push("catch_all = ?");
        values.push(payload.catch_all === true || payload.catch_all === 1 ? 1 : 0);
      }

      if (payload.plan !== undefined) {
        updates.push("plan = ?");
        values.push(payload.plan);
      }

      if (payload.route_to_primary !== undefined) {
        updates.push("route_to_primary = ?");
        values.push(payload.route_to_primary === true || payload.route_to_primary === 1 ? 1 : 0);
      }

      if (payload.is_primary !== undefined) {
        const isPrim = payload.is_primary === true || payload.is_primary === 1 ? 1 : 0;
        if (isPrim === 1) {
          db.prepare("UPDATE attached_domains SET is_primary = 0").run();
        }
        updates.push("is_primary = ?");
        values.push(isPrim);
      }
      
      values.push(id);
      
      const stmt = db.prepare(`UPDATE attached_domains SET ${updates.join(", ")} WHERE id = ?`);
      const info = stmt.run(...values);
      
      if (info.changes > 0) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain not found" }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Bulk updates routing for attached domains
   */
  static async bulkUpdateDomainRouting(req, res) {
    try {
      const payload = await parseJsonBody(req);
      if (!payload || payload.route_to_primary === undefined) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "route_to_primary field is required" }));
        return;
      }
      const routeFlag = payload.route_to_primary === true || payload.route_to_primary === 1 ? 1 : 0;
      
      if (Array.isArray(payload.domain_ids) && payload.domain_ids.length > 0) {
        const placeholders = payload.domain_ids.map(() => '?').join(',');
        db.prepare(`UPDATE attached_domains SET route_to_primary = ? WHERE id IN (${placeholders})`).run(routeFlag, ...payload.domain_ids);
      } else {
        // Apply to all attached domains
        db.prepare("UPDATE attached_domains SET route_to_primary = ?").run(routeFlag);
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, route_to_primary: routeFlag }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Verifies DNS configuration for an attached domain
   */
  static async verifyAttachedDomain(req, res, id) {
    try {
      const domainRecord = db.prepare("SELECT * FROM attached_domains WHERE id = ?").get(id);
      
      if (!domainRecord) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain not found" }));
        return;
      }

      const domain = domainRecord.domain;
      const dnsPromises = dns.promises;
      
      const results = {
        domain,
        mx: { valid: false, details: [] },
        a: { valid: false, details: [] },
        spf: { valid: false, details: [] },
        dkim: { valid: false, details: [] }
      };

      // Check MX
      try {
        const mxRecords = await dnsPromises.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
          results.mx.valid = true;
          results.mx.details = mxRecords.map(r => `${r.exchange} (priority ${r.priority})`);
        }
      } catch (e) {
        results.mx.error = e.code || e.message;
      }

      // Check A record (mail.<domain> or <domain>)
      try {
        const mailA = await dnsPromises.resolve4(`mail.${domain}`).catch(() => []);
        const rootA = await dnsPromises.resolve4(domain).catch(() => []);
        const ips = Array.from(new Set([...mailA, ...rootA]));
        if (ips.length > 0) {
          results.a.valid = true;
          results.a.details = ips;
        }
      } catch (e) {
        results.a.error = e.code || e.message;
      }

      // Check SPF TXT
      try {
        const txtRecords = await dnsPromises.resolveTxt(domain);
        const flatTxt = txtRecords.map(t => Array.isArray(t) ? t.join("") : t);
        const spf = flatTxt.find(t => typeof t === "string" && t.toLowerCase().includes("v=spf1"));
        if (spf) {
          results.spf.valid = true;
          results.spf.details = [spf];
        }
      } catch (e) {
        results.spf.error = e.code || e.message;
      }

      // Check DKIM TXT (check both mail._domainkey and default._domainkey)
      try {
        const mailDkim = await dnsPromises.resolveTxt(`mail._domainkey.${domain}`).catch(() => []);
        const defDkim = await dnsPromises.resolveTxt(`default._domainkey.${domain}`).catch(() => []);
        const allDkim = [...mailDkim, ...defDkim];
        const flatDkim = allDkim.map(t => Array.isArray(t) ? t.join("") : t);
        const dkim = flatDkim.find(t => typeof t === "string" && (t.toLowerCase().includes("v=dkim1") || t.includes("p=")));
        if (dkim) {
          results.dkim.valid = true;
          results.dkim.details = [dkim];
        }
      } catch (e) {
        results.dkim.error = e.code || e.message;
      }

      // Determine verification outcome
      const isVerified = results.mx.valid || (results.spf.valid && results.a.valid);
      const newStatus = isVerified ? "active" : domainRecord.status;

      if (isVerified && domainRecord.status !== "active") {
        db.prepare("UPDATE attached_domains SET status = 'active' WHERE id = ?").run(id);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        verified: isVerified,
        status: isVerified ? "active" : domainRecord.status,
        results
      }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Deletes an attached domain
   */
  static deleteAttachedDomain(req, res, id) {
    try {
      const stmt = db.prepare("DELETE FROM attached_domains WHERE id = ?");
      const info = stmt.run(id);
      
      if (info.changes > 0) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Domain not found" }));
      }
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // --- MAILBOX MANAGEMENT ---
  static getMailboxUsers(req, res, projectId) {
    try {
      const users = getMailboxUsers(projectId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ users }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async createMailboxUser(req, res, projectId) {
    try {
      const parsed = await parseJsonBody(req);
      if (!parsed || !parsed.email || !parsed.password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Email and password are required" }));
        return;
      }
      const { email, password } = parsed;

      const result = createMailboxUser(email, password, projectId);
      
      if (result.success) {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static deleteMailboxUser(req, res, projectId, userId) {
    try {
      const success = deleteMailboxUser(userId, projectId);
      
      if (success) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "User not found or does not belong to this project" }));
      }
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Returns current counts and metrics for the data seeding dashboard
   */
  static getSeedStatus(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const scope = url.searchParams.get("scope") || "admin";

      const localFiles = fs.existsSync(localMailDir) ? fs.readdirSync(localMailDir).filter(f => f.endsWith(".json")).length : 0;
      const liveFiles = fs.existsSync(liveMailDir) ? fs.readdirSync(liveMailDir).filter(f => f.endsWith(".json")).length : 0;
      const totalEmails = localFiles + liveFiles;

      const logsCount = db.prepare("SELECT COUNT(*) as count FROM system_logs").get()?.count || 0;
      const projectsCount = db.prepare("SELECT COUNT(*) as count FROM projects").get()?.count || 0;
      const domainsCount = db.prepare("SELECT COUNT(*) as count FROM attached_domains WHERE scope = ?").get(scope)?.count || 0;
      const primaryDomainRow = db.prepare("SELECT * FROM attached_domains WHERE is_primary = 1 AND scope = ? LIMIT 1").get(scope);
      const mailboxUsersCount = db.prepare("SELECT COUNT(*) as count FROM mailbox_table WHERE scope = ?").get(scope)?.count || 0;
      const apiHitsCount = db.prepare("SELECT SUM(hits) as sum FROM api_settings").get()?.sum || 0;

      // Calculate disk usage
      let diskBytes = 0;
      [localMailDir, liveMailDir, attachmentsDir].forEach(dir => {
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).forEach(file => {
            try { diskBytes += fs.statSync(path.join(dir, file)).size; } catch(e) {}
          });
        }
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        scope,
        totalEmails,
        localEmailsCount: localFiles,
        liveEmailsCount: liveFiles,
        logsCount,
        projectsCount,
        domainsCount,
        primaryDomain: primaryDomainRow ? `${primaryDomainRow.primary_prefix || 'admin'}@${primaryDomainRow.domain}` : null,
        mailboxUsersCount,
        apiHitsCount,
        diskUsageBytes: diskBytes,
        liveModeActive: process.env.live !== "false"
      }));
    } catch (err) {
      console.error("Error in getSeedStatus:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  /**
   * Handles seeding operations for emails, logs, domains, projects, and analytics
   */
  static async handleSeedData(req, res) {
    try {
      const parsed = await parseJsonBody(req);
      const action = parsed?.action || "all";
      const count = parseInt(parsed?.count, 10) || 0;
      const scope = parsed?.scope || "admin";
      const customDomain = parsed?.domain || null;
      const customProjectId = parsed?.projectId ? parseInt(parsed.projectId, 10) : null;

      // Helper to get active domains for this scope
      const primaryRow = db.prepare("SELECT domain, primary_prefix FROM attached_domains WHERE is_primary = 1 AND (scope = ? OR (? = 'devpanel' AND scope = 'devadmin')) LIMIT 1").get(scope, scope);
      const isDev = scope === 'devpanel' || scope === 'devadmin';
      const primaryDomain = customDomain || (primaryRow ? primaryRow.domain : (isDev ? "devmail.biz" : "micorna.biz"));
      const primaryPrefix = primaryRow?.primary_prefix || (isDev ? "dev" : "admin");
      const secondaryRow = db.prepare("SELECT domain FROM attached_domains WHERE is_primary = 0 AND (scope = ? OR (? = 'devpanel' AND scope = 'devadmin')) LIMIT 1").get(scope, scope);
      const secondaryDomain = secondaryRow?.domain || (isDev ? "devbox.org" : "visakara.org");

      const results = {
        action,
        scope,
        emailsSeeded: 0,
        logsSeeded: 0,
        domainsSeeded: 0,
        projectsSeeded: 0,
        analyticsSeeded: false,
        message: ""
      };

      // 1. SEED DOMAINS
      const seedDomains = () => {
        const dom1 = isDev ? "devmail.biz" : "micorna.biz";
        const dom2 = isDev ? "devbox.org" : "visakara.org";
        const prefix = isDev ? "dev" : "admin";

        // Ensure primary domain in scope
        const d1 = db.prepare("SELECT id FROM attached_domains WHERE domain = ? AND scope = ?").get(dom1, scope);
        if (d1) {
          db.prepare("UPDATE attached_domains SET is_primary = 1, primary_prefix = ?, status = 'active', plan = 'pro', catch_all = 1 WHERE id = ?").run(prefix, d1.id);
        } else {
          db.prepare("INSERT INTO attached_domains (domain, status, plan, catch_all, is_primary, primary_prefix, scope) VALUES (?, 'active', 'pro', 1, 1, ?, ?)").run(dom1, prefix, scope);
        }

        // Ensure secondary domain in scope
        const d2 = db.prepare("SELECT id FROM attached_domains WHERE domain = ? AND scope = ?").get(dom2, scope);
        if (d2) {
          db.prepare("UPDATE attached_domains SET is_primary = 0, primary_prefix = 'my', status = 'active', plan = 'free', catch_all = 1 WHERE id = ?").run(d2.id);
        } else {
          db.prepare("INSERT INTO attached_domains (domain, status, plan, catch_all, is_primary, primary_prefix, scope) VALUES (?, 'active', 'free', 1, 0, 'my', ?)").run(dom2, scope);
        }

        // Ensure primary mailbox user in scope
        const adminEmail = `${prefix}@${dom1}`;
        const userExists = db.prepare("SELECT id FROM mailbox_table WHERE email = ? AND scope = ?").get(adminEmail, scope);
        if (!userExists) {
          const defaultPwd = isDev ? "DevPanel@Pass2026!" : "Admin@Pass2026!";
          let hash = defaultPwd;
          try {
            if (typeof Bun !== "undefined" && Bun.password) {
              hash = Bun.password.hashSync(defaultPwd, { algorithm: "bcrypt", cost: 10 });
            }
          } catch(e) {}
          db.prepare("INSERT INTO mailbox_table (email, password_hash, plain_password, project_id, scope) VALUES (?, ?, ?, 1, ?)").run(adminEmail, hash, defaultPwd, scope);
        }

        results.domainsSeeded = 2;
      };

      // 2. SEED PROJECTS
      const seedProjects = () => {
        const demoProjects = [
          { name: "Enterprise Mail Notification Gateway", api_key: "pk_live_enterprise_9847291a", webhook_url: "https://api.mycompany.com/v1/email-webhooks", is_active: 1 },
          { name: "Mobile Auth & OTP Verification App", api_key: "pk_live_mobile_auth_3819280b", webhook_url: "https://auth.mycompany.com/otp-listener", is_active: 1 },
          { name: "E-Commerce Order Notification Bot", api_key: "pk_live_ecommerce_7482914c", webhook_url: "https://shop.mycompany.com/api/mails", is_active: 1 }
        ];

        let seeded = 0;
        demoProjects.forEach(p => {
          const existing = db.prepare("SELECT id FROM projects WHERE api_key = ? OR name = ?").get(p.api_key, p.name);
          if (!existing) {
            db.prepare("INSERT INTO projects (name, api_key, webhook_url, is_active) VALUES (?, ?, ?, ?)").run(p.name, p.api_key, p.webhook_url, p.is_active);
            seeded++;
          }
        });
        results.projectsSeeded = seeded || demoProjects.length;
      };

      // 3. SEED EMAILS (Max 10)
      const seedEmails = (targetCount = 10) => {
        const emailTemplates = [
          {
            from: "Stripe Notifications <billing@stripe.com>",
            to: `${primaryPrefix}@${primaryDomain}`,
            subject: "Invoice #INV-2026-9842 paid ($49.00 USD)",
            text: `Hi Admin,\n\nYour monthly subscription for "Cloud Mail Server Pro" has been successfully processed.\n\nAmount: $49.00 USD\nInvoice ID: INV-2026-9842\nPayment Method: Visa ending in 4242\nDate: ${new Date().toLocaleDateString()}\n\nThank you for choosing Stripe.`,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:580px;margin:0 auto;background:#0d1117;color:#c9d1d9;padding:24px;border:1px solid #30363d;border-radius:12px;"><div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #30363d;padding-bottom:16px;margin-bottom:20px;"><span style="font-size:20px;font-weight:700;color:#6366f1;">⚡ Stripe Billing</span><span style="background:rgba(16,185,129,0.15);color:#10b981;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">PAID</span></div><h2 style="color:#ffffff;margin:0 0 12px 0;font-size:18px;">Payment Confirmation</h2><p style="color:#8b949e;line-height:1.6;margin:0 0 16px 0;">Your monthly subscription for <strong style="color:#f0f6fc;">Cloud Mail Server Pro</strong> has processed successfully.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;background:#161b22;border-radius:8px;overflow:hidden;"><tr style="border-bottom:1px solid #30363d;"><td style="padding:12px 16px;color:#8b949e;font-size:13px;">Invoice Number</td><td style="padding:12px 16px;color:#f0f6fc;font-size:13px;font-weight:600;text-align:right;">#INV-2026-9842</td></tr><tr style="border-bottom:1px solid #30363d;"><td style="padding:12px 16px;color:#8b949e;font-size:13px;">Amount Paid</td><td style="padding:12px 16px;color:#10b981;font-size:14px;font-weight:700;text-align:right;">$49.00 USD</td></tr><tr><td style="padding:12px 16px;color:#8b949e;font-size:13px;">Payment Method</td><td style="padding:12px 16px;color:#f0f6fc;font-size:13px;text-align:right;">Visa •••• 4242</td></tr></table><p style="font-size:12px;color:#8b949e;margin-top:20px;">If you have any questions, reply directly to this email or visit our Help Center.</p></div>`,
            attachments: [
              { filename: "invoice_INV-2026-9842.pdf", size: 34210, contentType: "application/pdf", url: "/api/attachments/invoice_INV-2026-9842.pdf" }
            ],
            otp: ""
          },
          {
            from: "GitHub Security <security-noreply@github.com>",
            to: `devops@${primaryDomain}`,
            subject: "[Security Notice] New personal access token generated (repo_deploy_prod)",
            text: `Hey @devops,\n\nA new Personal Access Token (classic) named "repo_deploy_prod" was generated from IP address 192.0.2.84.\n\nScopes: repo, workflow, read:packages\nExpires: 90 days\n\nIf you did not initiate this action, please revoke the token immediately.`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0d1117;color:#c9d1d9;padding:24px;border:1px solid #30363d;border-radius:12px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;"><span style="font-size:24px;">🐙</span><h2 style="color:#ffffff;margin:0;font-size:18px;">GitHub Security Alert</h2></div><p style="color:#8b949e;line-height:1.6;">A new Personal Access Token with elevated permissions was generated on your account.</p><div style="background:#161b22;padding:16px;border-radius:8px;border-left:4px solid #f59e0b;margin:16px 0;"><div style="font-size:13px;color:#f0f6fc;margin-bottom:4px;"><strong>Token:</strong> repo_deploy_prod</div><div style="font-size:12px;color:#8b949e;"><strong>Client IP:</strong> 192.0.2.84 • <strong>Location:</strong> Ashburn, VA, US</div></div><a href="#" style="display:inline-block;background:#238636;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">Review Access Tokens</a></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "Amazon Web Services <no-reply@signin.aws>",
            to: `${primaryPrefix}@${primaryDomain}`,
            subject: "Your AWS verification code is 849-210",
            text: `Your AWS sign-in verification code is: 849210\n\nThis code will expire in 10 minutes. Do not share this code with anyone.`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#cbd5e1;padding:28px;border:1px solid #334155;border-radius:12px;text-align:center;"><div style="font-size:22px;font-weight:bold;color:#f59e0b;margin-bottom:8px;">AWS Security Verification</div><p style="color:#94a3b8;font-size:14px;margin:0 0 20px 0;">Use the 6-digit code below to complete your sign-in request.</p><div style="display:inline-block;background:#1e293b;border:2px dashed #f59e0b;padding:16px 36px;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:6px;color:#ffffff;margin-bottom:20px;">849210</div><p style="color:#64748b;font-size:12px;margin:0;">This verification code will expire in 10 minutes. If you did not request this, please contact AWS Support.</p></div>`,
            attachments: [],
            otp: "849210"
          },
          {
            from: "Google Cloud Alerts <cloud-alerts@google.com>",
            to: `alerts@${primaryDomain}`,
            subject: "[RESOLVED] Incident #GCP-89211: Compute Engine API latency normalized",
            text: `Incident #GCP-89211 has been resolved.\n\nDescription: Elevated API error rates in us-central1.\nDuration: 18 minutes.\nStatus: All systems operational.`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0d1117;color:#c9d1d9;padding:24px;border:1px solid #30363d;border-radius:12px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><span style="color:#4285f4;font-weight:700;font-size:18px;">Google Cloud Status</span><span style="background:rgba(16,185,129,0.2);color:#34d399;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:700;">RESOLVED</span></div><h3 style="color:#ffffff;margin:0 0 10px 0;">Incident Report #GCP-89211</h3><p style="color:#8b949e;line-height:1.5;">The latency spike in us-central1 has been mitigated. Automated recovery systems restored nominal routing across all regions.</p></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "PayPal Service <service@paypal.com>",
            to: `billing@${secondaryDomain}`,
            subject: "Receipt for your payment to DigitalOcean Holdings ($72.50 USD)",
            text: `You sent a payment of $72.50 USD to DigitalOcean Holdings.\n\nTransaction ID: 9XP847192A0912\nMerchant: DigitalOcean Cloud Infrastructure\nTotal: $72.50 USD`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border:1px solid #1e293b;border-radius:12px;"><div style="font-size:22px;font-weight:bold;color:#38bdf8;margin-bottom:16px;">PayPal</div><h3 style="color:#fff;margin:0 0 8px 0;">Payment Receipt</h3><p style="color:#94a3b8;font-size:14px;">You sent <strong>$72.50 USD</strong> to DigitalOcean Holdings.</p><div style="background:#1e293b;padding:12px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#cbd5e1;">Transaction ID: <span style="font-family:monospace;color:#38bdf8;">9XP847192A0912</span></div></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "Cloudflare Access <no-reply@cloudflare.com>",
            to: `security@${primaryDomain}`,
            subject: "Your Cloudflare Access OTP code is 629401",
            text: `Your Cloudflare Access single-use login code is: 629401. Valid for 15 minutes.`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#18181b;color:#f4f4f5;padding:28px;border:1px solid #27272a;border-radius:12px;text-align:center;"><div style="font-size:20px;font-weight:bold;color:#f97316;margin-bottom:8px;">Cloudflare Zero Trust</div><p style="color:#a1a1aa;font-size:14px;margin-bottom:20px;">Use this code to verify your identity for Admin Portal</p><div style="display:inline-block;background:#27272a;border:1px solid #f97316;padding:14px 32px;border-radius:10px;font-size:28px;font-weight:800;letter-spacing:5px;color:#fb923c;margin-bottom:20px;">629401</div></div>`,
            attachments: [],
            otp: "629401"
          },
          {
            from: "Slack Notifications <notifications@slack.com>",
            to: `team@${primaryDomain}`,
            subject: "Digest: 8 new messages in #engineering-backend and #devops",
            text: `Here is your Slack digest for today:\n\n#engineering-backend: @alex: API endpoints v2 deployed successfully.\n#devops: @sarah: Certificate auto-renewal completed for micorna.biz.`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#1e1e2e;color:#cdd6f4;padding:24px;border:1px solid #313244;border-radius:12px;"><h3 style="color:#cba6f7;margin:0 0 12px 0;">💬 Slack Daily Digest</h3><p style="color:#a6adc8;line-height:1.5;">You have 8 unread messages across your team channels.</p><div style="background:#181825;padding:12px;border-radius:8px;margin:12px 0;"><strong style="color:#89b4fa;">#engineering-backend:</strong> <span style="color:#bac2de;">API endpoints v2 deployed and validated.</span></div></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "OpenAI Platform <support@openai.com>",
            to: `${primaryPrefix}@${primaryDomain}`,
            subject: "API Usage Tier upgraded to Tier 4: Higher concurrency unlocked",
            text: `Congratulations! Your organization has reached Tier 4 usage. Rate limit is now 10,000 RPM and 2,000,000 TPM for GPT-4o.`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#101214;color:#ececf1;padding:24px;border:1px solid #202123;border-radius:12px;"><div style="font-size:20px;font-weight:bold;color:#10a37f;margin-bottom:8px;">OpenAI Platform</div><h3 style="color:#ffffff;margin:0 0 10px 0;">Tier 4 Upgrade Confirmed</h3><p style="color:#acacbe;line-height:1.5;">Your spending tier has automatically upgraded based on payment history. You now have access to higher concurrency limits.</p></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "Vercel Deployments <deployments@vercel.com>",
            to: `builds@${secondaryDomain}`,
            subject: "Production deployment ready for email-server-vps (Commit: a8f912c)",
            text: `Vercel Deployment Succeeded!\n\nProject: email-server-vps\nEnvironment: Production\nBuild Time: 34s\nURL: https://mailserver10.com`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#000000;color:#ededed;padding:24px;border:1px solid #333333;border-radius:12px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><span style="font-size:24px;font-weight:bold;">▲ Vercel</span><span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:4px 10px;border-radius:16px;font-size:12px;">READY</span></div><p style="color:#888888;">Production deployment completed in 34 seconds.</p></div>`,
            attachments: [],
            otp: ""
          },
          {
            from: "MailServer Setup <welcome@micorna.biz>",
            to: `${primaryPrefix}@${primaryDomain}`,
            subject: "Welcome to your Dedicated Private Mail Server (VPS Node #1)",
            text: `Welcome to your self-hosted mail server!\n\nPrimary Domain: ${primaryDomain}\nSMTP Port: 25 / 2525\nIMAP Port: 993 (SSL)\nDKIM & SPF Status: Operational`,
            html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0b0f19;color:#e2e8f0;padding:28px;border:1px solid #1e293b;border-radius:12px;"><div style="font-size:22px;font-weight:bold;color:#10b981;margin-bottom:12px;">🚀 Mail Server Node Active</div><p style="color:#94a3b8;line-height:1.6;">Your high-performance private mail infrastructure is fully configured and accepting inbound and outbound traffic.</p><div style="background:#111827;padding:16px;border-radius:8px;border:1px solid #1f2937;margin:16px 0;"><div style="color:#f3f4f6;font-weight:600;margin-bottom:6px;">Node Details:</div><div style="font-size:13px;color:#9ca3af;">• Primary Domain: <span style="color:#10b981;">${primaryDomain}</span><br/>• IMAP Storage: <span style="color:#60a5fa;">Dovecot Maildir / SQLite WAL</span><br/>• DKIM Selector: <span style="color:#fbbf24;">mail._domainkey</span></div></div></div>`,
            attachments: [],
            otp: ""
          }
        ];

        const actualLimit = Math.min(Math.max(targetCount, 1), 10);
        const templatesToSeed = emailTemplates.slice(0, actualLimit);

        [localMailDir, liveMailDir].forEach(dir => {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        const targetProjId = customProjectId || 1;

        templatesToSeed.forEach((tpl, idx) => {
          const timestamp = Date.now() - (idx * 35 * 60 * 1000);
          const dateObj = new Date(timestamp);
          const randHex = Math.random().toString(36).substring(2, 8);
          const fileName = `${timestamp}-demo-${randHex}.json`;

          const mailPayload = {
            id: `mail_demo_${timestamp}_${randHex}`,
            from: tpl.from,
            to: tpl.to,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html,
            date: dateObj.toISOString(),
            senderIp: "54.240.8.125",
            headers: {
              "message-id": `<${randHex}@demo-server>`,
              "from": tpl.from,
              "to": tpl.to,
              "subject": tpl.subject,
              "date": dateObj.toUTCString()
            },
            attachments: tpl.attachments || [],
            otp: tpl.otp || ""
          };

          // Save to both live and local directories
          fs.writeFileSync(path.join(liveMailDir, fileName), JSON.stringify(mailPayload, null, 2), "utf-8");
          fs.writeFileSync(path.join(localMailDir, fileName), JSON.stringify(mailPayload, null, 2), "utf-8");

          // Save to DB tables
          const totalAttSize = (tpl.attachments || []).reduce((sum, a) => sum + (a.size || 0), 0);
          const attName = tpl.attachments?.length > 0 ? tpl.attachments[0].filename : null;
          
          try {
            const stmt = db.prepare("INSERT INTO received_emails (recipient, sender, subject, has_attachment, attachment_size, file_name, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            stmt.run(tpl.to, tpl.from, tpl.subject, tpl.attachments?.length > 0 ? 1 : 0, totalAttSize, fileName, targetProjId, dateObj.toISOString());
          } catch(e) {}

          try {
            const genStmt = db.prepare("INSERT INTO generated_emails (email, ip_address, project_id, created_at) VALUES (?, ?, ?, ?)");
            genStmt.run(tpl.to, "127.0.0.1", targetProjId, dateObj.toISOString());
          } catch(e) {}
        });

        results.emailsSeeded = templatesToSeed.length;
      };

      // 4. SEED SYSTEM LOGS (Max 100)
      const seedLogs = (targetCount = 100) => {
        const actualCount = Math.min(Math.max(targetCount, 10), 100);

        const logActions = [
          { type: "RECEIVE", status: "SUCCESS", msg: "SMTP_INBOUND: Received message from <notifications@stripe.com> for <admin@micorna.biz> (14.2 KB, TLS 1.3)", details: { client_ip: "54.240.8.125", protocol: "SMTP", size: 14280, tls: "TLSv1.3" } },
          { type: "RECEIVE", status: "SUCCESS", msg: "DKIM_VERIFY: Verified signature for domain stripe.com (selector: s1, result: PASS)", details: { domain: "stripe.com", selector: "s1", result: "PASS" } },
          { type: "RECEIVE", status: "SUCCESS", msg: "SPF_CHECK: Client IP 54.240.8.125 passed SPF validation for domain stripe.com", details: { client_ip: "54.240.8.125", domain: "stripe.com", result: "PASS" } },
          { type: "API", status: "SUCCESS", msg: "API_AUTH: Validated Bearer API token pk_live_enterprise_9847291a for endpoint /api/mailbox/get", details: { endpoint: "/api/mailbox/admin@micorna.biz", status_code: 200, duration_ms: 2.4 } },
          { type: "API", status: "SUCCESS", msg: "API_DISPATCH: Generated transient mailbox session temp_user_9812@micorna.biz", details: { endpoint: "/api/mailbox/generate", domain: "micorna.biz" } },
          { type: "AUTH", status: "SUCCESS", msg: "ADMIN_LOGIN: Dashboard session authenticated for user admin from IP 127.0.0.1", details: { username: "admin", ip: "127.0.0.1", method: "password" } },
          { type: "AUTH", status: "SUCCESS", msg: "IMAP_AUTH: Dovecot SSL authentication succeeded for mailbox user admin@micorna.biz", details: { user: "admin@micorna.biz", protocol: "IMAPS", port: 993 } },
          { type: "SYSTEM", status: "INFO", msg: "DKIM_ROTATE: Verified RSA-2048 keypair active and synced with DNS TXT record", details: { key_length: 2048, selector: "mail._domainkey" } },
          { type: "SYSTEM", status: "INFO", msg: "STORAGE_CLEANUP: Retention cycle executed - 0 expired records purged", details: { scanned_files: 42, purged: 0 } },
          { type: "SYSTEM", status: "INFO", msg: "DATABASE_CHECKPOINT: SQLite WAL checkpoint completed (0 dirty pages remaining)", details: { pragma: "wal_checkpoint", status: "ok" } },
          { type: "SEND", status: "SUCCESS", msg: "SMTP_RELAY: Outbound email delivered to mx1.mail.protection.outlook.com [250 2.0.0 OK]", details: { recipient: "client@outlook.com", response: "250 2.0.0 OK", latency_ms: 142 } },
          { type: "API", status: "SUCCESS", msg: "WEBHOOK_DISPATCH: Webhook notification posted to https://api.mycompany.com/v1/email-webhooks (200 OK)", details: { url: "https://api.mycompany.com/v1/email-webhooks", status: 200, duration_ms: 68 } },
          { type: "SYSTEM", status: "WARN", msg: "RATE_LIMIT_NOTICE: IP 198.51.100.22 approached request threshold (48/50 req/min)", details: { client_ip: "198.51.100.22", count: 48, limit: 50 } },
          { type: "API", status: "WARN", msg: "SLOW_QUERY_ALERT: DB query took 18ms on full table scan", details: { query: "SELECT * FROM received_emails", time_ms: 18 } },
          { type: "SYSTEM", status: "ERROR", msg: "WEBHOOK_TIMEOUT: Webhook delivery to https://webhook.site/demo-fail timed out after 5000ms", details: { target: "https://webhook.site/demo-fail", error: "ETIMEDOUT", retry: "1/3" } }
        ];

        const insertStmt = db.prepare("INSERT INTO system_logs (log_type, status, message, details, project_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))");
        const apiLogStmt = db.prepare("INSERT INTO project_api_logs (project_id, endpoint, method, created_at) VALUES (?, ?, ?, datetime('now', ?))");

        const targetProjId = customProjectId || 1;

        for (let i = 0; i < actualCount; i++) {
          const tpl = logActions[i % logActions.length];
          const minutesAgo = -Math.floor((i * 18) + (Math.random() * 5));
          const timeModifier = `${minutesAgo} minutes`;

          insertStmt.run(
            tpl.type,
            tpl.status,
            `#${actualCount - i} ${tpl.msg}`,
            JSON.stringify(tpl.details),
            targetProjId,
            timeModifier
          );

          if (i % 2 === 0) {
            apiLogStmt.run(
              targetProjId,
              tpl.details?.endpoint || "/api/mailbox/get",
              "GET",
              timeModifier
            );
          }
        }

        results.logsSeeded = actualCount;
      };

      // 5. SEED TRAFFIC & OVERVIEW STATS
      const seedAnalytics = () => {
        // Seed 7-day traffic points
        for (let d = 0; d < 7; d++) {
          const genCount = Math.floor(18 + Math.random() * 25);
          const recCount = Math.floor(24 + Math.random() * 35);

          for (let g = 0; g < genCount; g++) {
            const hourOffset = Math.floor(Math.random() * 20);
            db.prepare(`INSERT INTO generated_emails (email, ip_address, project_id, created_at) VALUES ('demo_${d}_${g}@${primaryDomain}', '127.0.0.1', 1, datetime('now', '-${d} days', '+${hourOffset} hours'))`).run();
          }

          for (let r = 0; r < recCount; r++) {
            const hourOffset = Math.floor(Math.random() * 20);
            db.prepare(`INSERT INTO received_emails (recipient, sender, subject, has_attachment, project_id, created_at) VALUES ('admin@${primaryDomain}', 'service@demo.com', 'Demo Subject ${d}-${r}', 0, 1, datetime('now', '-${d} days', '+${hourOffset} hours'))`).run();
          }
        }

        // Set realistic API hits in api_settings
        const hitsMap = {
          "mailbox-generate": 384,
          "mailbox-custom": 192,
          "mailbox-get": 842,
          "mailbox-otps": 298,
          "api-domains": 520,
          "live-emails": 460,
          "local-emails": 210,
          "admin-stats": 720
        };

        Object.entries(hitsMap).forEach(([id, hits]) => {
          try {
            db.prepare("UPDATE api_settings SET hits = hits + ? WHERE id = ?").run(hits, id);
          } catch(e) {}
        });

        results.analyticsSeeded = true;
      };

      // CLEAR ACTIONS
      const clearEmails = () => {
        let deletedFiles = 0;
        [localMailDir, liveMailDir, attachmentsDir, maildirDir].forEach(dir => {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
              const fullPath = path.join(dir, f);
              try {
                if (fs.statSync(fullPath).isDirectory()) {
                  fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(fullPath);
                }
                deletedFiles++;
              } catch(e) {}
            });
          }
        });
        db.prepare("DELETE FROM received_emails").run();
        db.prepare("DELETE FROM generated_emails").run();
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('received_emails', 'generated_emails')").run(); } catch(e) {}
        try { db.exec("VACUUM;"); } catch(e) {}
        results.message = `All mailbox emails and disk storage wiped successfully (${deletedFiles} files removed).`;
      };

      const clearLogs = () => {
        db.prepare("DELETE FROM system_logs").run();
        db.prepare("DELETE FROM project_api_logs").run();
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('system_logs', 'project_api_logs')").run(); } catch(e) {}
        try { db.exec("VACUUM;"); } catch(e) {}
        results.message = "All system audit logs and project API logs cleared.";
      };

      const clearProjects = () => {
        db.prepare("DELETE FROM projects").run();
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name = 'projects'").run(); } catch(e) {}
        results.message = "All API projects and webhooks cleared.";
      };

      const clearHits = () => {
        try { db.prepare("UPDATE api_settings SET hits = 0").run(); } catch(e) {}
        try { db.prepare("DELETE FROM project_api_logs").run(); } catch(e) {}
        results.message = "All API route hits and project counters reset to 0.";
      };

      const scopeLabel = (scope === 'devpanel' || scope === 'devadmin') ? "DevPanel" : "Client Admin";

      const clearDomains = () => {
        db.prepare("DELETE FROM attached_domains WHERE is_primary = 0 AND scope = ?").run(scope);
        results.message = `All secondary attached domains cleared for ${scopeLabel}.`;
      };

      const clearPrimaryDomain = () => {
        db.prepare("DELETE FROM attached_domains WHERE is_primary = 1 AND scope = ?").run(scope);
        results.message = `Primary domain configuration cleared for ${scopeLabel}.`;
      };

      const clearAllDomains = () => {
        db.prepare("DELETE FROM attached_domains WHERE scope = ?").run(scope);
        results.message = `All attached and primary domains cleared for ${scopeLabel}.`;
      };

      const clearMailboxes = () => {
        db.prepare("DELETE FROM mailbox_table WHERE scope = ?").run(scope);
        results.message = `All permanent mailbox accounts cleared for ${scopeLabel}.`;
      };

      const clearSelective = (targets = []) => {
        const executed = [];
        if (targets.includes("emails")) { clearEmails(); executed.push("Emails"); }
        if (targets.includes("logs")) { clearLogs(); executed.push("System Logs"); }
        if (targets.includes("domains")) { clearDomains(); executed.push("Attached Domains"); }
        if (targets.includes("primary_domain")) { clearPrimaryDomain(); executed.push("Primary Domain"); }
        if (targets.includes("all_domains")) { clearAllDomains(); executed.push("All Domains"); }
        if (targets.includes("mailboxes")) { clearMailboxes(); executed.push("Mailbox Users"); }
        if (targets.includes("projects")) { clearProjects(); executed.push("API Projects"); }
        if (targets.includes("hits")) { clearHits(); executed.push("Route Hits & Stats"); }
        
        try {
          db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
          db.exec("VACUUM;");
        } catch(e) {}

        results.message = `Successfully deleted selected categories: ${executed.join(", ")}.`;
      };

      const clearAll = () => {
        // 1. Wipe all files in storage/live, storage/local, storage/media-mails, and storage/maildir
        let totalFilesDeleted = 0;
        [localMailDir, liveMailDir, attachmentsDir, maildirDir].forEach(dir => {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            files.forEach(f => {
              const fullPath = path.join(dir, f);
              try {
                if (fs.statSync(fullPath).isDirectory()) {
                  fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(fullPath);
                }
                totalFilesDeleted++;
              } catch(e) {}
            });
          }
        });

        // 2. Wipe SQLite tables
        try { db.prepare("DELETE FROM received_emails").run(); } catch(e) {}
        try { db.prepare("DELETE FROM generated_emails").run(); } catch(e) {}
        try { db.prepare("DELETE FROM system_logs").run(); } catch(e) {}
        try { db.prepare("DELETE FROM project_api_logs").run(); } catch(e) {}
        try { db.prepare("DELETE FROM projects").run(); } catch(e) {}
        try { db.prepare("UPDATE api_settings SET hits = 0").run(); } catch(e) {}
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('received_emails', 'generated_emails', 'system_logs', 'project_api_logs', 'projects')").run(); } catch(e) {}
        
        // 3. Reclaim disk space
        try {
          db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
          db.exec("VACUUM;");
        } catch(e) {}

        results.message = `Complete environment wiped successfully! All emails (${totalFilesDeleted} files), system logs, projects, and traffic stats reset.`;
      };

      // Execute requested action
      if (action === "all") {
        seedDomains();
        seedProjects();
        seedEmails(10);
        seedLogs(100);
        seedAnalytics();
        results.message = "Successfully seeded full demo suite: 10 emails, 100 logs, domains, projects & 7-day traffic analytics!";
      } else if (action === "emails") {
        seedEmails(count || 10);
        results.message = `Successfully seeded ${results.emailsSeeded} demo emails across live and local consoles!`;
      } else if (action === "logs") {
        seedLogs(count || 100);
        results.message = `Successfully seeded ${results.logsSeeded} server and system logs!`;
      } else if (action === "domains") {
        seedDomains();
        results.message = `Successfully initialized primary domain (${primaryDomain}) and secondary attached domain (${secondaryDomain})!`;
      } else if (action === "projects") {
        seedProjects();
        results.message = `Successfully seeded ${results.projectsSeeded} demo API projects and webhooks!`;
      } else if (action === "analytics") {
        seedAnalytics();
        results.message = "Successfully seeded 7-day traffic analytics and API route counters!";
      } else if (action === "clear_emails") {
        clearEmails();
      } else if (action === "clear_logs") {
        clearLogs();
      } else if (action === "clear_projects") {
        clearProjects();
      } else if (action === "clear_hits") {
        clearHits();
      } else if (action === "clear_domains") {
        clearDomains();
      } else if (action === "clear_primary_domain") {
        clearPrimaryDomain();
      } else if (action === "clear_all_domains") {
        clearAllDomains();
      } else if (action === "clear_mailboxes") {
        clearMailboxes();
      } else if (action === "clear_selective") {
        clearSelective(parsed?.targets || []);
      } else if (action === "clear_all") {
        clearAll();
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown seed action: ${action}` }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, ...results }));
    } catch (err) {
      console.error("Error in handleSeedData:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}

