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

// Enable WAL mode for better concurrency
db.exec("PRAGMA journal_mode = WAL;");

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

db.exec(`
  CREATE TABLE IF NOT EXISTS attached_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

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

export function updateProjectRetention(projectId, settings) {
  try {
    const { retention_generated_emails = 0, retention_simple_mails = 0, retention_attachments = 0 } = settings;
    const stmt = db.prepare(`
      UPDATE projects 
      SET retention_generated_emails = ?, 
          retention_simple_mails = ?, 
          retention_attachments = ? 
      WHERE id = ?
    `);
    stmt.run(retention_generated_emails, retention_simple_mails, retention_attachments, projectId);
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
    
    // Get all projects with active retention policies
    const projects = db.prepare("SELECT id, retention_generated_emails, retention_simple_mails, retention_attachments FROM projects").all();
    
    let deletedGenerated = 0;
    let deletedReceived = 0;
    
    for (const project of projects) {
      const { id, retention_generated_emails, retention_simple_mails, retention_attachments } = project;
      
      // Cleanup Generated Emails
      if (retention_generated_emails && retention_generated_emails > 0) {
        const result = db.prepare(`DELETE FROM generated_emails WHERE project_id = ? AND created_at < datetime('now', ?)`).run(id, `-${retention_generated_emails} days`);
        deletedGenerated += result.changes || 0;
      }
      
      // Cleanup Simple Mails
      if (retention_simple_mails && retention_simple_mails > 0) {
        const records = db.prepare(`SELECT id, file_name FROM received_emails WHERE project_id = ? AND has_attachment = 0 AND created_at < datetime('now', ?)`).all(id, `-${retention_simple_mails} days`);
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
      if (retention_attachments && retention_attachments > 0) {
        const records = db.prepare(`SELECT id, file_name FROM received_emails WHERE project_id = ? AND has_attachment = 1 AND created_at < datetime('now', ?)`).all(id, `-${retention_attachments} days`);
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
    const stmt = db.prepare("SELECT domain FROM attached_domains WHERE status = 'active' ORDER BY created_at DESC");
    const records = stmt.all();
    return records.map(r => r.domain.replace(/^https?:\/\//, '').replace(/\/+$/, ''));
  } catch (err) {
    console.error("DB Error fetching active domains:", err);
    return [];
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

export function getSystemLogs(log_type, page = 1, limit = 50) {
  try {
    const offset = (page - 1) * limit;
    let stmt, countStmt, count, logs;
    
    if (log_type === "ALL") {
      stmt = db.prepare(`SELECT * FROM system_logs ORDER BY id DESC LIMIT ? OFFSET ?`);
      countStmt = db.prepare(`SELECT COUNT(*) as count FROM system_logs`);
      count = countStmt.get().count;
      logs = stmt.all(limit, offset).map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }));
    } else {
      stmt = db.prepare(`SELECT * FROM system_logs WHERE log_type = ? ORDER BY id DESC LIMIT ? OFFSET ?`);
      countStmt = db.prepare(`SELECT COUNT(*) as count FROM system_logs WHERE log_type = ?`);
      count = countStmt.get(log_type).count;
      logs = stmt.all(log_type, limit, offset).map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }));
    }
    
    return { data: logs, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } };
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
  } catch (err) {
    console.error("DB Error clearing system logs:", err);
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

// Export the db instance for complex queries
export default db;
