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

db.exec(`
  CREATE TABLE IF NOT EXISTS attached_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Export the db instance for complex queries
export default db;
