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
  { id: "api-domains", method: "GET", path: "/api/domains", desc: "Fetch all active domains available for generating temporary emails.", enabled: true, category: "Mailbox UI", hits: 0, auth: false, variables: "None" },
  { id: "mailbox-generate", method: "GET", path: "/api/mailbox/generate", desc: "Generate a new random temporary email address. Optionally pass ?domain= to choose a specific domain.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "?domain=example.com (Optional)" },
  { id: "mailbox-custom", method: "GET", path: "/api/mailbox/custom", desc: "Create a custom temporary email address with your chosen name using ?name= and optional ?domain=.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "?name=username&domain=example.com" },
  { id: "mailbox-get", method: "GET", path: "/api/mailbox/:email", desc: "List of inboxes by email (get all received emails and messages for a specific email address).", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email" },
  { id: "get-attachment", method: "GET", path: "/api/attachments/:filename", desc: "Download an attached file (image, PDF, document) from a received email using its filename.", enabled: true, category: "Mailbox UI", hits: 0, auth: false, variables: "Params: :filename" },
  { id: "mailbox-delete", method: "DELETE", path: "/api/mailbox/:email", desc: "Delete all received emails and messages for a specific email address.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email" },
  { id: "mailbox-delete-one", method: "DELETE", path: "/api/mailbox/:email/:mailId", desc: "Delete a single specific email by its ID from a mailbox.", enabled: true, category: "Mailbox UI", hits: 0, auth: true, variables: "Params: :email, :mailId" },
  { id: "mailbox-client-inbox", method: "GET", path: "/api/mailbox/inbox", desc: "Get the list of received emails for the logged-in mailbox user.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "?page=1&limit=200&filter=all&search=keyword" },
  { id: "mailbox-client-count", method: "GET", path: "/api/mailbox/count", desc: "Get the total number of emails in the user inbox (useful for badges).", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "None" },
  { id: "mailbox-client-read", method: "GET", path: "/api/mailbox/inbox/:id", desc: "Get full details, text, HTML, and attachments of a specific email by its ID.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "Params: :id" },
  { id: "mailbox-client-media", method: "GET", path: "/api/mailbox/media", desc: "Get all file attachments received in the user mailbox with download links.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "None" },
  { id: "mailbox-client-login", method: "POST", path: "/api/mailbox/login", desc: "Login as a mailbox user using email and password to get an access token.", enabled: true, category: "Mailbox Client", hits: 0, auth: false, variables: "Body: JSON {email, password}" },
  { id: "mailbox-client-delete", method: "DELETE", path: "/api/mailbox/inbox/:id", desc: "Delete a specific email from the logged-in user inbox.", enabled: true, category: "Mailbox Client", hits: 0, auth: true, variables: "Params: :id" },
  { id: "smtp-list", method: "GET", path: "/api/admin/smtp", desc: "Get all configured SMTP sender email addresses.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "None" },
  { id: "smtp-create", method: "POST", path: "/api/admin/smtp", desc: "Create a new SMTP sender email address for sending emails.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {email, password, domain, description}" },
  { id: "smtp-send", method: "POST", path: "/api/admin/smtp/send", desc: "Send a single email (with text, HTML, and attachments) via SMTP.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {from, to, subject, text, html, attachments}" },
  { id: "smtp-send-bulk", method: "POST", path: "/api/admin/smtp/send-bulk", desc: "Send emails to multiple recipients one by one with a safe delay between each email.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {from, recipients: [...], subject, text, html, delaySeconds: 5}" },
  { id: "smtp-test", method: "POST", path: "/api/admin/smtp/test", desc: "Send a test email to verify SMTP relay configuration.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Body: JSON {toEmail, fromEmail, subject, text}" },
  { id: "smtp-delete", method: "DELETE", path: "/api/admin/smtp/:identifier", desc: "Delete an SMTP sender email address by its ID or email.", enabled: true, category: "SMTP Outbound API", hits: 0, auth: true, variables: "Params: :identifier (ID or Email)" },
  { id: "admin-stats", method: "GET", path: "/api/admin/stats", desc: "Get server stats including total emails received, disk usage, and server uptime.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-stats-traffic", method: "GET", path: "/api/admin/stats/traffic", desc: "Get real-time traffic data, request counts, and API analytics.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "all-mails", method: "GET", path: "/api/mails", desc: "Fetch all incoming emails across the entire server for admin monitoring.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "mailbox-client-info", method: "GET", path: "/api/mailbox/info", desc: "Get IMAP/POP3 hostnames, ports, and configuration details for webmail.", enabled: true, category: "Admin Management", hits: 0, auth: false, variables: "None" },
  { id: "admin-projects", method: "GET", path: "/api/admin/projects", desc: "List all developer projects and their API keys.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-projects-emails", method: "GET", path: "/api/admin/projects/:id/emails", desc: "Get all emails received under a specific project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-files", method: "GET", path: "/api/admin/projects/:id/files", desc: "Get all attachment files stored under a specific project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-domains", method: "GET", path: "/api/admin/domains", desc: "List all domain names connected to this email server.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-credentials", method: "GET", path: "/api/admin/credentials", desc: "View and manage outbound SMTP login credentials.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-server-info", method: "GET", path: "/api/admin/serverinfo", desc: "Get server details including IP address, status, and DKIM public key.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-dblogs", method: "GET", path: "/api/admin/dblogs/:type", desc: "View database activity and error logs (e.g. SMTP_IN, SMTP_OUT, ERROR, ALL).", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :type (ALL, ERROR, SMTP_IN, SMTP_OUT)" },
  { id: "admin-mailbox-users-list", method: "GET", path: "/api/admin/mailbox-users", desc: "Get a list of all permanent mailbox accounts, passwords, and project IDs.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "api-settings", method: "GET", path: "/api/admin/api-settings", desc: "View all API routes, their hit counts, and whether they are turned ON or OFF.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "get-retention-settings", method: "GET", path: "/api/project/retention", desc: "Get the auto-cleanup time limit (in hours) for temporary emails and attachments.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "get-allowed-files", method: "GET", path: "/api/project/allowed-files", desc: "Get the list of allowed file extensions (like png, jpg, pdf) for email attachments.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "get-forbidden-ids", method: "GET", path: "/api/project/forbidden-ids", desc: "Get the list of blocked email usernames (like admin, support, root) that users cannot create.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-login", method: "POST", path: "/api/admin/login", desc: "Login to the admin dashboard and receive an authentication Bearer token.", enabled: true, category: "Admin Management", hits: 0, auth: false, variables: "Body: JSON {username, password}" },
  { id: "admin-projects-create", method: "POST", path: "/api/admin/projects", desc: "Create a new developer project and generate its API key.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {name, plan}" },
  { id: "admin-domains-create", method: "POST", path: "/api/admin/domains", desc: "Add a new domain name to the email server.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {domain, is_primary}" },
  { id: "admin-mailbox-users-create", method: "POST", path: "/api/admin/mailbox-users", desc: "Create a new permanent mailbox user account with email and password.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {email, password, projectId}" },
  { id: "api-settings-toggle", method: "POST", path: "/api/admin/api-settings/toggle", desc: "Enable or disable a specific API route instantly.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {id, enabled}" },
  { id: "api-settings-reset", method: "POST", path: "/api/admin/api-settings/reset-hits", desc: "Reset hit counters for all API routes.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "None" },
  { id: "admin-projects-update", method: "PUT", path: "/api/admin/projects/:id", desc: "Update project name, rate limits, or webhook configuration.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id, Body: JSON {name, plan}" },
  { id: "admin-projects-retention", method: "PUT", path: "/api/admin/projects/:id/retention", desc: "Configure data retention hours for a specific project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id, Body: JSON {retention}" },
  { id: "admin-domains-update", method: "PUT", path: "/api/admin/domains/:id", desc: "Update status or settings for a specific connected domain.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id, Body: JSON {status, catch_all}" },
  { id: "admin-mailbox-users-update", method: "PUT", path: "/api/admin/mailbox-users/:id", desc: "Change the password or project for an existing mailbox user account.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id, Body: JSON {password, projectId}" },
  { id: "update-retention-settings", method: "PUT", path: "/api/project/retention", desc: "Update how long (in hours) emails and attachments are kept before being automatically deleted.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {retention}" },
  { id: "update-allowed-files", method: "PUT", path: "/api/project/allowed-files", desc: "Update the list of allowed file extensions for email attachments.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {allowedFiles}" },
  { id: "update-forbidden-ids", method: "PUT", path: "/api/project/forbidden-ids", desc: "Update the list of blocked email usernames that cannot be generated.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Body: JSON {forbiddenIds}" },
  { id: "admin-projects-delete", method: "DELETE", path: "/api/admin/projects/:id", desc: "Permanently delete a developer project and its associated API key.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-projects-hits", method: "DELETE", path: "/api/admin/projects/:id/hits", desc: "Reset API usage hits for a specific project.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-domains-delete", method: "DELETE", path: "/api/admin/domains/:id", desc: "Remove a domain from the email server.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" },
  { id: "admin-mailbox-users-delete", method: "DELETE", path: "/api/admin/mailbox-users/:id", desc: "Permanently delete a mailbox user account by ID.", enabled: true, category: "Admin Management", hits: 0, auth: true, variables: "Params: :id" }
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
      (req.headers && (req.headers["x-scope"] === "devpanel" || req.headers["x-scope"] === "dev"));
    const scope = isDevScope ? "dev" : "admin";

    const list = getApiSettingsList(scope);
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
      const isDevScope = (req.url && (req.url.startsWith("/api/devpanel") || req.url.startsWith("/api/dev-admin") || req.url.startsWith("/api/dev"))) ||
        (req.headers && (req.headers["x-scope"] === "devpanel" || req.headers["x-scope"] === "dev"));
      const scope = isDevScope ? "dev" : "admin";

      const parsed = await parseJsonBody(req);
      if (!parsed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const { id, enabled } = parsed;
      const cleanId = id ? id.replace(/^dev-/, "") : id;
      const success = toggleApiSettingDB(cleanId, enabled, scope);
      if (success) {
        const list = getApiSettingsList(scope);
        const api = list.find(a => a.id === cleanId);
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
      const isDevScope = (req.url && (req.url.startsWith("/api/devpanel") || req.url.startsWith("/api/dev-admin") || req.url.startsWith("/api/dev"))) ||
        (req.headers && (req.headers["x-scope"] === "devpanel" || req.headers["x-scope"] === "dev"));
      const scope = isDevScope ? "dev" : "admin";
      resetApiSettingsHits(scope);
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
        } catch (e) { }
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
        } catch (e) { }
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

    const isDev = cleanUrl.startsWith("/api/devpanel/") || cleanUrl.startsWith("/api/dev-admin/") || cleanUrl.startsWith("/api/dev/");
    const scope = isDev ? "dev" : "admin";
    const normUrl = cleanUrl.replace(/^\/api\/devpanel\//, "/api/admin/").replace(/^\/api\/dev-admin\//, "/api/admin/").replace(/^\/api\/dev\//, "/api/");

    const list = getApiSettingsList(scope);
    // Find matching API config
    const api = list.find(a => {
      // Direct path match
      if (a.path === cleanUrl || a.path === normUrl) return true;

      // Dynamic pattern matches:
      if (a.id === "api-domains" && (normUrl === "/api/domains" || cleanUrl === "/api/domains") && method === "GET") {
        return true;
      }
      if (a.id === "mailbox-get" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && method === "GET") {
        const parts = normUrl.split("/");
        return parts.length === 4; // /api/mailbox/user@domain.com
      }
      if (a.id === "mailbox-delete-one" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && method === "DELETE") {
        const parts = normUrl.split("/");
        return parts.length === 5;
      }
      if (a.id === "mailbox-delete" && (normUrl.startsWith("/api/mailbox/") || cleanUrl.startsWith("/api/mailbox/")) && method === "DELETE") {
        const parts = normUrl.split("/");
        return parts.length === 4;
      }

      return false;
    });

    if (api) {
      if (!api.enabled) {
        return false;
      }
      incrementApiHits(api.id, scope); // Increment usage statistics count
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
            } catch (e) { }
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
      } catch (e) { }

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
      } catch (e) { }

      // Outbound / Sent emails count
      let sentCount = 0;
      try {
        const sentRow = db.prepare("SELECT COUNT(*) as count FROM sent_emails WHERE scope = ? OR ? = 'all'").get(scope, scope);
        sentCount = sentRow?.count || 0;
        if (sentCount === 0) {
          const sysSent = db.prepare("SELECT COUNT(*) as count FROM system_logs WHERE log_type = 'SEND'").get();
          sentCount = sysSent?.count || 0;
        }
      } catch (e) { }

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
          } catch (e) { }
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


}

