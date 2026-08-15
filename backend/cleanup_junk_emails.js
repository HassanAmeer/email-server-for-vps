import db, { getPrimaryDomain } from "./database/db.js";
import path from "path";
import fs from "fs";

console.log("🧹 Starting Email Purge & Clean Sample Initialization...");

// 1. Get primary domain
const primary = getPrimaryDomain();
const primaryDomain = primary ? primary.domain : "mailserver10.com";
const adminEmail = `admin@${primaryDomain}`;

// 2. Clear old JSON storage files
const storageDirs = [
  path.join(process.cwd(), "backend", "storage", "live"),
  path.join(process.cwd(), "backend", "storage", "local")
];

for (const dir of storageDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    console.log(`Deleting ${files.length} old email files from ${dir}...`);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch (e) {}
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 3. Clear received_emails table
const beforeCount = db.prepare("SELECT count(*) as c FROM received_emails").get().c;
console.log(`Old received_emails count: ${beforeCount}`);
db.prepare("DELETE FROM received_emails").run();

// 4. Create Sample Email 1: Welcome & Setup Email
const sample1FileName = `${Date.now()}-welcome-to-email-server.json`;
const sample1Data = {
  from: `"Mail Server Setup" <welcome@${primaryDomain}>`,
  to: adminEmail,
  subject: "🎉 Welcome to your High-Performance VPS Mail Server",
  date: new Date().toISOString(),
  senderIp: "127.0.0.1",
  text: `Welcome to your VPS Email Server!\n\nYour server is running with active IMAP/IMAPS (Ports 993/143), zero-duplication Maildir architecture, and Catch-All streaming enabled.\n\nPrimary Domain: ${primaryDomain}\nStatus: Active & Operational\nPagination Limit: 200 emails per page\n\nEnjoy sending and receiving emails seamlessly!`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; color: #f1f5f9;">
      <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🎉 Welcome to Your VPS Mail Server</h1>
        <p style="color: #cbd5e1; margin: 5px 0 0; font-size: 13px;">Zero-Duplication IMAP + Webmail Suite</p>
      </div>
      <div style="background: #111827; padding: 20px; border-radius: 10px; border: 1px solid #1f2937; margin-bottom: 15px;">
        <p style="margin: 0 0 10px; color: #94a3b8; font-size: 13px;"><strong>Primary Server Domain:</strong> <span style="color: #60a5fa; font-family: monospace;">${primaryDomain}</span></p>
        <p style="margin: 0 0 10px; color: #94a3b8; font-size: 13px;"><strong>IMAPS Port:</strong> <span style="color: #34d399; font-weight: bold;">993 (SSL Encrypted)</span></p>
        <p style="margin: 0 0 10px; color: #94a3b8; font-size: 13px;"><strong>IMAP Port:</strong> <span style="color: #38bdf8; font-weight: bold;">143 (Plain / STARTTLS)</span></p>
        <p style="margin: 0; color: #94a3b8; font-size: 13px;"><strong>Stream Architecture:</strong> <span style="color: #a78bfa;">Catch-All Active (All Inbound)</span></p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">
        All inbound messages sent to any email address on your server will stream directly into this IMAP mailbox in real time. Use the search bar to find emails by sender, recipient, or subject.
      </p>
    </div>
  `,
  attachments: []
};

// 5. Create Sample Email 2: Media & Attachment Demonstration
const sample2FileName = `${Date.now() + 1000}-system-report-sample.json`;
// 1x1 PNG transparent dot base64
const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const sample2Data = {
  from: `"Security & Monitoring" <security@${primaryDomain}>`,
  to: adminEmail,
  subject: "📊 Dovecot IMAP & Storage Health Report (Attachment Included)",
  date: new Date(Date.now() - 3600000).toISOString(),
  senderIp: "127.0.0.1",
  text: `System Health Report:\n\n- Dovecot Daemon: Running\n- Storage Mode: Zero Duplication Maildir\n- Attached report: system_metrics.png (1.2 KB)`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; color: #f1f5f9;">
      <h2 style="color: #38bdf8; margin-top: 0;">📊 Automated Server Diagnostics</h2>
      <p style="color: #cbd5e1; font-size: 14px;">All core mail server daemons are running optimally with zero packet drop.</p>
      <div style="background: #111827; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 15px 0;">
        <span style="color: #10b981; font-weight: bold;">✓ Dovecot IMAP: Active</span><br/>
        <span style="color: #10b981; font-weight: bold;">✓ Node / Bun SMTP: Active</span><br/>
        <span style="color: #10b981; font-weight: bold;">✓ Maildir Inode Link: 0 Bytes Overhead</span>
      </div>
      <p style="color: #94a3b8; font-size: 12px;">Attachment preview is available below.</p>
    </div>
  `,
  attachments: [
    {
      filename: "server_status_badge.png",
      contentType: "image/png",
      size: 1240,
      content: samplePngBase64,
      url: `data:image/png;base64,${samplePngBase64}`
    }
  ]
};

// Write files to both storage dirs if present
for (const dir of storageDirs) {
  fs.writeFileSync(path.join(dir, sample1FileName), JSON.stringify(sample1Data, null, 2));
  fs.writeFileSync(path.join(dir, sample2FileName), JSON.stringify(sample2Data, null, 2));
}

// Insert into DB
const insertStmt = db.prepare(`
  INSERT INTO received_emails (recipient, sender, subject, has_attachment, attachment_size, file_name, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertStmt.run(
  sample1Data.to,
  sample1Data.from,
  sample1Data.subject,
  0,
  0,
  sample1FileName,
  sample1Data.date.replace("T", " ").substring(0, 19)
);

insertStmt.run(
  sample2Data.to,
  sample2Data.from,
  sample2Data.subject,
  1,
  1240,
  sample2FileName,
  sample2Data.date.replace("T", " ").substring(0, 19)
);

const finalCount = db.prepare("SELECT count(*) as c FROM received_emails").get().c;
console.log(`✅ Cleanup Complete! Current clean email count: ${finalCount}`);
