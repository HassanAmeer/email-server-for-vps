import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

// Ensure storage directory exists
const storageDir = path.join(process.cwd(), "backend", "storage");
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(storageDir, "email_logs.sqlite");
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and set busy timeout
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 10000;");

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    endpoint TEXT NOT NULL,
    method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS generated_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS received_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT,
    has_attachment BOOLEAN DEFAULT 0,
    attachment_size INTEGER DEFAULT 0,
    file_name TEXT,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Auto-migrate schema (add project_id if missing for backward compatibility)
try { db.exec(`ALTER TABLE generated_emails ADD COLUMN project_id INTEGER;`); } catch (e) { }
try { db.exec(`ALTER TABLE received_emails ADD COLUMN project_id INTEGER;`); } catch (e) { }
try { db.exec(`ALTER TABLE received_emails ADD COLUMN attachment_size INTEGER DEFAULT 0;`); } catch (e) { }
try { db.exec(`ALTER TABLE received_emails ADD COLUMN file_name TEXT;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN is_active BOOLEAN DEFAULT 1;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_generated_emails INTEGER DEFAULT 0;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_simple_mails INTEGER DEFAULT 0;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_attachments INTEGER DEFAULT 0;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN forbidden_ids TEXT DEFAULT 'admin,info,support,contact,mail,office,user';`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN forbidden_ids_free TEXT DEFAULT 'admin,info,support,contact,mail,office,user';`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN forbidden_ids_pro TEXT DEFAULT 'admin,support,info';`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_generated_emails_free INTEGER DEFAULT 1;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_generated_emails_pro INTEGER DEFAULT 30;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_simple_mails_free INTEGER DEFAULT 1;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_simple_mails_pro INTEGER DEFAULT 30;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_attachments_free INTEGER DEFAULT 1;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN retention_attachments_pro INTEGER DEFAULT 30;`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN allowed_files_free TEXT DEFAULT 'txt,png,jpg,jpeg,pdf,zip';`); } catch (e) { }
try { db.exec(`ALTER TABLE projects ADD COLUMN allowed_files_pro TEXT DEFAULT 'txt,sql,png,zip,pdf,ai,mp3,mp4,jpg,jpeg,gif';`); } catch (e) { }
try { db.exec(`ALTER TABLE attached_domains ADD COLUMN catch_all BOOLEAN DEFAULT 1;`); } catch (e) { }
try { db.exec(`ALTER TABLE attached_domains ADD COLUMN is_primary BOOLEAN DEFAULT 0;`); } catch (e) { }
try { db.exec(`ALTER TABLE attached_domains ADD COLUMN primary_prefix TEXT DEFAULT 'my';`); } catch (e) { }
try { db.exec(`ALTER TABLE mailbox_users ADD COLUMN plain_password TEXT;`); } catch (e) { }

db.exec(`
  CREATE TABLE IF NOT EXISTS attached_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec(`ALTER TABLE attached_domains ADD COLUMN plan TEXT DEFAULT 'free';`); } catch (e) { }

db.exec(`
  CREATE TABLE IF NOT EXISTS api_settings (
    id TEXT PRIMARY KEY,
    method TEXT,
    path TEXT,
    desc TEXT,
    enabled BOOLEAN DEFAULT 1,
    category TEXT,
    hits INTEGER DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mailbox_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Key-Value server flags table (persists across restarts)
db.exec(`
  CREATE TABLE IF NOT EXISTS server_flags (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '0'
  );
`);

// Initialize default flags (only if not already set)
const flagDefaults = { rcpt_logging: '0' };
for (const [key, val] of Object.entries(flagDefaults)) {
  try {
    db.prepare("INSERT OR IGNORE INTO server_flags (key, value) VALUES (?, ?)").run(key, val);
  } catch (e) {}
}

export function getSetting(key) {
  try {
    const row = db.prepare("SELECT value FROM server_flags WHERE key = ?").get(key);
    return row ? row.value : null;
  } catch (e) { return null; }
}

export function setSetting(key, value) {
  try {
    db.prepare("INSERT OR REPLACE INTO server_flags (key, value) VALUES (?, ?)").run(key, String(value));
    return true;
  } catch (e) { return false; }
}

export function getAllFlags() {
  try {
    const rows = db.prepare("SELECT key, value FROM server_flags").all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch (e) { return {}; }
}

// Helper to log generated emails
export function logGeneratedEmail(email, ip_address, project_id = null) {
  try {
    const stmt = db.prepare("INSERT INTO generated_emails (email, ip_address, project_id) VALUES (?, ?, ?)");
    stmt.run(email, ip_address || "Unknown", project_id);
  } catch (err) {
    console.error("DB Error logging generated email:", err);
  }
}

// Helper to log received emails
export function logReceivedEmail(recipient, sender, subject, hasAttachment, project_id = null, attachment_size = 0, file_name = null) {
  try {
    const stmt = db.prepare("INSERT INTO received_emails (recipient, sender, subject, has_attachment, project_id, attachment_size, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)");
    stmt.run(recipient, sender, subject || "", hasAttachment ? 1 : 0, project_id, attachment_size, file_name);
  } catch (err) {
    console.error("DB Error logging received email:", err);
  }
}

// Helper to log API Hits
export function logProjectApiHit(projectId, endpoint, method = "GET") {
  try {
    const stmt = db.prepare("INSERT INTO project_api_logs (project_id, endpoint, method) VALUES (?, ?, ?)");
    stmt.run(projectId, endpoint, method);
  } catch (err) {
    console.error("DB Error logging project API hit:", err);
  }
}

export function resetProjectHits(projectId) {
  try {
    db.prepare("DELETE FROM project_api_logs WHERE project_id = ?").run(projectId);
  } catch (err) {
    console.error("DB Error resetting project API hits:", err);
  }
}

// --- PROJECT HELPERS ---
export function getProjectByApiKey(apiKey) {
  try {
    const stmt = db.prepare("SELECT * FROM projects WHERE api_key = ?");
    return stmt.get(apiKey);
  } catch (err) {
    console.error("DB Error getting project:", err);
    return null;
  }
}

export function getProjectByEmail(email) {
  try {
    // Find which project generated this email
    const stmt = db.prepare(`
      SELECT p.* FROM generated_emails g
      JOIN projects p ON g.project_id = p.id
      WHERE g.email = ?
      ORDER BY g.id DESC LIMIT 1
    `);
    return stmt.get(email);
  } catch (err) {
    console.error("DB Error finding project by email:", err);
    return null;
  }
}

export function getProjectForbiddenIds(projectId) {
  try {
    const row = db.prepare("SELECT forbidden_ids, forbidden_ids_free, forbidden_ids_pro FROM projects WHERE id = ?").get(projectId);
    if (!row) return { free: [], pro: [] };
    
    // Fallback to legacy 'forbidden_ids' if free is empty
    const freeRaw = row.forbidden_ids_free || row.forbidden_ids || "";
    const proRaw = row.forbidden_ids_pro || "";

    return {
      free: freeRaw.split(',').map(id => id.trim().toLowerCase()).filter(Boolean),
      pro: proRaw.split(',').map(id => id.trim().toLowerCase()).filter(Boolean)
    };
  } catch (e) {
    return { free: [], pro: [] };
  }
}

export function updateProjectForbiddenIds(projectId, forbiddenIds) {
  try {
    const freeStr = Array.isArray(forbiddenIds.free) ? forbiddenIds.free.map(id => id.trim().toLowerCase()).filter(Boolean).join(',') : "";
    const proStr = Array.isArray(forbiddenIds.pro) ? forbiddenIds.pro.map(id => id.trim().toLowerCase()).filter(Boolean).join(',') : "";
    
    db.prepare("UPDATE projects SET forbidden_ids_free = ?, forbidden_ids_pro = ? WHERE id = ?").run(freeStr, proStr, projectId);
    return true;
  } catch (e) {
    return false;
  }
}

export function getProjectAllowedFiles(projectId) {
  try {
    const row = db.prepare("SELECT allowed_files_free, allowed_files_pro FROM projects WHERE id = ?").get(projectId);
    if (!row) return { free: [], pro: [] };
    
    return {
      free: (row.allowed_files_free || "").split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean),
      pro: (row.allowed_files_pro || "").split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean)
    };
  } catch (e) {
    return { free: [], pro: [] };
  }
}

export function updateProjectAllowedFiles(projectId, allowedFiles) {
  try {
    const freeStr = Array.isArray(allowedFiles.free) ? allowedFiles.free.map(ext => ext.trim().toLowerCase()).filter(Boolean).join(',') : "";
    const proStr = Array.isArray(allowedFiles.pro) ? allowedFiles.pro.map(ext => ext.trim().toLowerCase()).filter(Boolean).join(',') : "";
    
    db.prepare("UPDATE projects SET allowed_files_free = ?, allowed_files_pro = ? WHERE id = ?").run(freeStr, proStr, projectId);
    return true;
  } catch (e) {
    return false;
  }
}

export function getProjectApisList() {
  try {
    const list = db.prepare("SELECT id, name, api_key, is_active, created_at, retention_generated_emails, retention_simple_mails, retention_attachments FROM projects").all();
    
    // Attach statistics
    return list.map(project => {
      const generatedCount = db.prepare("SELECT COUNT(*) as count FROM generated_emails WHERE project_id = ?").get(project.id).count;
      const receivedCount = db.prepare("SELECT COUNT(*) as count FROM received_emails WHERE project_id = ?").get(project.id).count;
      const apiHits = db.prepare("SELECT COUNT(*) as count FROM project_api_logs WHERE project_id = ?").get(project.id).count;
      
      return {
        ...project,
        stats: {
          generatedEmails: generatedCount,
          receivedEmails: receivedCount,
          apiHits: apiHits
        }
      };
    });
  } catch (err) {
    console.error("DB Error getting project APIs:", err);
    return [];
  }
}

export function getProjectRetention(projectId) {
  try {
    const row = db.prepare(`SELECT 
      retention_generated_emails, retention_simple_mails, retention_attachments,
      retention_generated_emails_free, retention_generated_emails_pro,
      retention_simple_mails_free, retention_simple_mails_pro,
      retention_attachments_free, retention_attachments_pro
      FROM projects WHERE id = ?`).get(projectId);
      
    if (!row) return null;
    
    return {
      free: {
        generated_emails: row.retention_generated_emails_free ?? row.retention_generated_emails ?? 0,
        simple_mails: row.retention_simple_mails_free ?? row.retention_simple_mails ?? 0,
        attachments: row.retention_attachments_free ?? row.retention_attachments ?? 0
      },
      pro: {
        generated_emails: row.retention_generated_emails_pro ?? row.retention_generated_emails ?? 0,
        simple_mails: row.retention_simple_mails_pro ?? row.retention_simple_mails ?? 0,
        attachments: row.retention_attachments_pro ?? row.retention_attachments ?? 0
      }
    };
  } catch (err) {
    console.error("DB Error getting project retention:", err);
    return null;
  }
}

export function updateProjectRetention(projectId, settings) {
  try {
    const free = settings.free || {};
    const pro = settings.pro || {};
    
    const stmt = db.prepare(`
      UPDATE projects 
      SET retention_generated_emails_free = ?, 
          retention_simple_mails_free = ?, 
          retention_attachments_free = ?,
          retention_generated_emails_pro = ?, 
          retention_simple_mails_pro = ?, 
          retention_attachments_pro = ?
      WHERE id = ?
    `);
    stmt.run(
      free.generated_emails || 0, free.simple_mails || 0, free.attachments || 0,
      pro.generated_emails || 0, pro.simple_mails || 0, pro.attachments || 0,
      projectId
    );
    return true;
  } catch (err) {
    console.error("DB Error updating project retention:", err);
    return false;
  }
}

export function runDataRetentionCleanupJob() {
  try {
    console.log("Running Data Retention Cleanup Job...");
    const targetDir = path.join(process.cwd(), "backend", "storage", "live");
    
    const projects = db.prepare("SELECT id FROM projects").all();
    const domainsWithPlan = getActiveDomainsWithPlan();
    
    let deletedGenerated = 0;
    let deletedReceived = 0;
    
    for (const project of projects) {
      const retentionSettings = getProjectRetention(project.id);
      if (!retentionSettings) continue;

      for (const domainObj of domainsWithPlan) {
        const domain = domainObj.domain;
        const plan = domainObj.plan === "premium" ? "pro" : "free";
        const settings = retentionSettings[plan];
        
        if (!settings) continue;

        const retention_generated_emails = settings.generated_emails || 0;
        const retention_simple_mails = settings.simple_mails || 0;
        const retention_attachments = settings.attachments || 0;
        
        // Cleanup Generated Emails
        if (retention_generated_emails > 0) {
          const result = db.prepare(`DELETE FROM generated_emails WHERE project_id = ? AND email LIKE ? AND created_at < datetime('now', ?)`).run(project.id, `%@${domain}`, `-${retention_generated_emails} hours`);
          deletedGenerated += result.changes || 0;
        }
        
        // Cleanup Simple Mails
        if (retention_simple_mails > 0) {
          const records = db.prepare(`SELECT id, file_name FROM received_emails WHERE project_id = ? AND has_attachment = 0 AND recipient LIKE ? AND created_at < datetime('now', ?)`).all(project.id, `%@${domain}`, `-${retention_simple_mails} hours`);
          for (const record of records) {
            if (record.file_name) {
               const filePath = path.join(targetDir, record.file_name);
               if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            db.prepare(`DELETE FROM received_emails WHERE id = ?`).run(record.id);
            deletedReceived++;
          }
        }
        
        // Cleanup Attachments Mails
        if (retention_attachments > 0) {
          const records = db.prepare(`SELECT id, file_name FROM received_emails WHERE project_id = ? AND has_attachment = 1 AND recipient LIKE ? AND created_at < datetime('now', ?)`).all(project.id, `%@${domain}`, `-${retention_attachments} hours`);
          for (const record of records) {
            if (record.file_name) {
               const filePath = path.join(targetDir, record.file_name);
               if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            db.prepare(`DELETE FROM received_emails WHERE id = ?`).run(record.id);
            deletedReceived++;
          }
        }
      }
    }
    
    console.log(`Data Retention Cleanup Completed: Removed ${deletedGenerated} generated emails, ${deletedReceived} received emails.`);
  } catch (err) {
    console.error("DB Error running data retention cleanup job:", err);
  }
}

export function getProjectEmails(project_id, page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;
    
    // We only fetch received emails as per request
    const stmt = db.prepare(`SELECT * FROM received_emails WHERE project_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`);
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM received_emails WHERE project_id = ?`);
    
    const count = countStmt.get(project_id).count;
    const emails = stmt.all(project_id, limit, offset);
    
    return { data: emails, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } };
  } catch (err) {
    console.error("DB Error fetching project emails:", err);
    return { data: [], pagination: { total: 0, page, limit, totalPages: 1 } };
  }
}

export function getProjectFilesList(project_id) {
  try {
    const filesList = [];
    let totalSize = 0;
    
    const records = db.prepare(`SELECT id, file_name, created_at, has_attachment FROM received_emails WHERE project_id = ?`).all(project_id);
    
    const liveDir = path.join(process.cwd(), "backend", "storage", "live");
    const localDir = path.join(process.cwd(), "backend", "storage", "local");
    const mediaDir = path.join(process.cwd(), "backend", "storage", "media-mails");

    for (const record of records) {
      if (record.file_name) {
        let filePath = path.join(liveDir, record.file_name);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(localDir, record.file_name);
        }

        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          filesList.push({
            id: `json-${record.id}`,
            name: record.file_name,
            type: 'JSON Email Data',
            sizeBytes: stats.size,
            createdAt: record.created_at
          });
          totalSize += stats.size;
          
          if (record.has_attachment) {
            try {
              const fileContent = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(fileContent);
              if (parsed.attachments && Array.isArray(parsed.attachments)) {
                for (const att of parsed.attachments) {
                  if (att.url) {
                    const attFilename = att.url.split("/").pop();
                    const attPath = path.join(mediaDir, attFilename);
                    if (fs.existsSync(attPath)) {
                      const attStats = fs.statSync(attPath);
                      filesList.push({
                        id: `att-${record.id}-${attFilename}`,
                        name: attFilename,
                        type: 'Media Attachment',
                        sizeBytes: attStats.size,
                        createdAt: record.created_at
                      });
                      totalSize += attStats.size;
                    }
                  }
                }
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    }
    
    // Sort files by newest first
    filesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { files: filesList, totalSizeBytes: totalSize };
  } catch (err) {
    console.error("DB Error fetching project files:", err);
    return { files: [], totalSizeBytes: 0 };
  }
}

export function getActiveDomains() {
  try {
    const stmt = db.prepare("SELECT domain FROM attached_domains WHERE status = 'active' ORDER BY is_primary DESC, created_at DESC");
    const records = stmt.all();
    return records.map(r => r.domain.replace(/^https?:\/\//, '').replace(/\/+$/, ''));
  } catch (err) {
    console.error("DB Error fetching active domains:", err);
    return [];
  }
}

export function getActiveDomainsWithPlan() {
  try {
    const stmt = db.prepare("SELECT domain, plan, is_primary FROM attached_domains WHERE status = 'active' ORDER BY is_primary DESC, created_at DESC");
    const records = stmt.all();
    return records.map(r => ({
      domain: r.domain.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      plan: r.plan || 'free',
      is_primary: r.is_primary === 1
    }));
  } catch (err) {
    console.error("DB Error fetching active domains with plan:", err);
    return [];
  }
}

export function getPrimaryDomain() {
  try {
    const primary = db.prepare("SELECT * FROM attached_domains WHERE is_primary = 1 LIMIT 1").get();
    if (primary) return primary;
    const firstActive = db.prepare("SELECT * FROM attached_domains WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").get();
    return firstActive || null;
  } catch (err) {
    console.error("DB Error fetching primary domain:", err);
    return null;
  }
}

export function setPrimaryDomain(id) {
  try {
    const target = db.prepare("SELECT * FROM attached_domains WHERE id = ?").get(id);
    if (!target) return false;
    db.transaction(() => {
      db.prepare("UPDATE attached_domains SET is_primary = 0").run();
      db.prepare("UPDATE attached_domains SET is_primary = 1 WHERE id = ?").run(id);
    })();
    return true;
  } catch (err) {
    console.error("DB Error setting primary domain:", err);
    return false;
  }
}

export function validateRecipientCatchAll(email) {
  if (!email) return false;
  const match = email.match(/@(.+)$/);
  if (!match) return false;
  const domain = match[1].toLowerCase().trim();

  try {
    const domainRecord = db.prepare("SELECT catch_all FROM attached_domains WHERE domain = ?").get(domain);
    
    // If not found, default to accepting it (backward compatibility for unattached domains)
    if (!domainRecord) return true;

    // If catch_all is explicitly ON
    if (domainRecord.catch_all === 1) return true;

    // If catch_all is OFF, check if email was explicitly generated
    const exactEmail = db.prepare("SELECT id FROM generated_emails WHERE email = ?").get(email.toLowerCase().trim());
    return !!exactEmail;

  } catch (err) {
    console.error("DB Error validating catch_all:", err);
    return true; // Failsafe
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper to log system events
export function logSystemEvent({ log_type, status, message, details = null, project_id = null }) {
  try {
    const stmt = db.prepare("INSERT INTO system_logs (log_type, status, message, details, project_id) VALUES (?, ?, ?, ?, ?)");
    stmt.run(log_type, status, message, details ? JSON.stringify(details) : null, project_id);
    
    // Auto cleanup old logs (older than 15 days)
    cleanupOldSystemLogs(15);
  } catch (err) {
    console.error("DB Error logging system event:", err);
  }
}

export function cleanupOldSystemLogs(days = 15) {
  try {
    const stmt = db.prepare(`DELETE FROM system_logs WHERE created_at < datetime('now', ?)`);
    stmt.run(`-${days} days`);
  } catch (err) {
    console.error("DB Error cleaning old system logs:", err);
  }
}

export function getSystemLogs(log_type, page = 1, limit = 50, search = "") {
  try {
    const offset = (page - 1) * limit;
    let whereClauses = [];
    let params = [];
    let countParams = [];

    if (log_type && log_type !== "ALL") {
      whereClauses.push("log_type = ?");
      params.push(log_type);
      countParams.push(log_type);
    }

    if (search && typeof search === "string" && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClauses.push("(message LIKE ? OR details LIKE ? OR status LIKE ? OR log_type LIKE ?)");
      params.push(s, s, s, s);
      countParams.push(s, s, s, s);
    }

    const whereStr = whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";
    const query = `SELECT * FROM system_logs${whereStr} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as count FROM system_logs${whereStr}`;

    const countStmt = db.prepare(countQuery);
    const count = countStmt.get(...countParams).count;

    const stmt = db.prepare(query);
    params.push(limit, offset);
    const logs = stmt.all(...params).map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }));
    
    return { data: logs, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 } };
  } catch (err) {
    console.error("DB Error fetching system logs:", err);
    return { data: [], pagination: { total: 0, page, limit, totalPages: 1 } };
  }
}

export function clearSystemLogs(log_type) {
  try {
    if (log_type === "ALL") {
      db.prepare(`DELETE FROM system_logs`).run();
    } else {
      const stmt = db.prepare(`DELETE FROM system_logs WHERE log_type = ?`);
      stmt.run(log_type);
    }
    return { success: true };
  } catch (err) {
    console.error("DB Error clearing system logs:", err);
    return { success: false, error: err.message };
  }
}

export function deleteSystemLogsByIds(ids) {
  try {
    if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 };
    const cleanIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (cleanIds.length === 0) return { success: true, count: 0 };
    const placeholders = cleanIds.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM system_logs WHERE id IN (${placeholders})`);
    const info = stmt.run(...cleanIds);
    return { success: true, count: info.changes };
  } catch (err) {
    console.error("DB Error deleting system logs by IDs:", err);
    return { success: false, error: err.message };
  }
}

export function initApiSettings(settingsArray) {
  try {
    const stmt = db.prepare(`
      INSERT INTO api_settings (id, method, path, desc, enabled, category, hits)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        desc = excluded.desc,
        path = excluded.path,
        method = excluded.method,
        category = excluded.category
    `);
    for (const api of settingsArray) {
      stmt.run(api.id, api.method, api.path, api.desc, api.enabled ? 1 : 0, api.category, api.hits || 0);
    }
  } catch (err) {
    console.error("DB Error initializing API settings:", err);
  }
}

export function getApiSettingsList() {
  try {
    const rows = db.prepare("SELECT * FROM api_settings").all();
    return rows.map(r => ({ ...r, enabled: r.enabled === 1 }));
  } catch (err) {
    console.error("DB Error getting API settings:", err);
    return [];
  }
}

export function toggleApiSettingDB(id, enabled) {
  try {
    db.prepare("UPDATE api_settings SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
    return true;
  } catch (err) {
    console.error("DB Error toggling API setting:", err);
    return false;
  }
}

export function incrementApiHits(id) {
  try {
    db.prepare("UPDATE api_settings SET hits = hits + 1 WHERE id = ?").run(id);
  } catch (err) {
    console.error("DB Error incrementing API hit:", err);
  }
}

export function resetApiSettingsHits() {
  try {
    db.prepare("UPDATE api_settings SET hits = 0").run();
  } catch (err) {
    console.error("DB Error resetting API hits:", err);
  }
}

// --- WEBMAIL HELPERS ---
export function createMailboxUser(email, password, projectId) {
  try {
    const hash = Bun.password.hashSync(password, { algorithm: "bcrypt" });
    const stmt = db.prepare("INSERT INTO mailbox_users (email, password_hash, plain_password, project_id) VALUES (?, ?, ?, ?)");
    stmt.run(email, hash, password, projectId);
    return { success: true };
  } catch (err) {
    console.error("DB Error creating mailbox user:", err);
    return { success: false, error: err.message };
  }
}

export function updateMailboxUser(userId, password, projectId = null) {
  try {
    const hash = Bun.password.hashSync(password, { algorithm: "bcrypt" });
    let stmt;
    if (projectId) {
      stmt = db.prepare("UPDATE mailbox_users SET password_hash = ?, plain_password = ? WHERE id = ? AND project_id = ?");
      stmt.run(hash, password, userId, projectId);
    } else {
      stmt = db.prepare("UPDATE mailbox_users SET password_hash = ?, plain_password = ? WHERE id = ?");
      stmt.run(hash, password, userId);
    }
    return { success: true };
  } catch (err) {
    console.error("DB Error updating mailbox user:", err);
    return { success: false, error: err.message };
  }
}

export function getMailboxUsers(projectId) {
  try {
    const stmt = db.prepare("SELECT id, email, plain_password, created_at FROM mailbox_users WHERE project_id = ? ORDER BY id DESC");
    return stmt.all(projectId);
  } catch (err) {
    console.error("DB Error getting mailbox users:", err);
    return [];
  }
}

export function deleteMailboxUser(userId, projectId) {
  try {
    const stmt = db.prepare("DELETE FROM mailbox_users WHERE id = ? AND project_id = ?");
    const info = stmt.run(userId, projectId);
    return info.changes > 0;
  } catch (err) {
    console.error("DB Error deleting mailbox user:", err);
    return false;
  }
}

export function isPrimaryMailboxUser(email) {
  if (!email) return false;
  try {
    const primary = getPrimaryDomain();
    if (!primary) return false;
    const cleanEmail = email.toLowerCase().trim();
    const primaryDomainName = (primary.domain || "").toLowerCase().trim();
    const primaryPrefix = (primary.primary_prefix || "my").toLowerCase().trim();
    const primaryFullAddress = `${primaryPrefix}@${primaryDomainName}`;

    // Exact match with primary address (e.g. my@jk.com) OR any address under primary domain
    if (cleanEmail === primaryFullAddress || cleanEmail.endsWith(`@${primaryDomainName}`)) {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error checking isPrimaryMailboxUser:", err);
    return false;
  }
}

export function verifyMailboxUser(email, password) {
  try {
    const stmt = db.prepare("SELECT * FROM mailbox_users WHERE email = ?");
    const user = stmt.get(email);
    if (!user) return null;
    
    let isValid = false;
    try {
      isValid = Bun.password.verifySync(password, user.password_hash);
    } catch (e) {
      isValid = false;
    }

    if (!isValid && (user.plain_password === password || user.password_hash === password)) {
      isValid = true;
    }

    if (isValid) {
      // Don't return the hash
      const { password_hash, ...safeUser } = user;
      safeUser.is_primary = isPrimaryMailboxUser(user.email);
      return safeUser;
    }
    return null;
  } catch (err) {
    console.error("DB Error verifying mailbox user:", err);
    return null;
  }
}

export function getMailboxInbox(email, page = 1, limit = 200, search = "", filter = "all") {
  try {
    const parsedPage = Math.max(1, parseInt(page || 1, 10));
    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit || 200, 10)));
    const offset = (parsedPage - 1) * parsedLimit;
    const isPrimary = isPrimaryMailboxUser(email);
    
    let query = "SELECT id, recipient, sender, subject, has_attachment, attachment_size, created_at, file_name FROM received_emails";
    let countQuery = "SELECT COUNT(*) as count FROM received_emails";
    let whereClauses = [];
    let params = [];
    let countParams = [];

    if (!isPrimary) {
      whereClauses.push("recipient = ?");
      params.push(email);
      countParams.push(email);
    }

    if (filter === "with_attachments") {
      whereClauses.push("has_attachment = 1");
    } else if (filter === "simple") {
      whereClauses.push("has_attachment = 0");
    }

    if (search && search.trim().length > 0) {
      whereClauses.push("(recipient LIKE ? OR sender LIKE ? OR subject LIKE ?)");
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
      countParams.push(s, s, s);
    }

    if (whereClauses.length > 0) {
      const whereStr = " WHERE " + whereClauses.join(" AND ");
      query += whereStr;
      countQuery += whereStr;
    }

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(parsedLimit, offset);

    const totalRecords = db.prepare(countQuery).get(...countParams).count;
    const data = db.prepare(query).all(...params);
    const totalPages = Math.ceil(totalRecords / parsedLimit);

    return {
      data,
      isPrimaryMailbox: isPrimary,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalRecords,
        totalPages
      }
    };
  } catch (err) {
    console.error("DB Error getting mailbox inbox:", err);
    return { data: [], isPrimaryMailbox: false, pagination: { page: 1, limit: 200, totalRecords: 0, totalPages: 0 } };
  }
}

// Export the db instance for complex queries
export default db;
