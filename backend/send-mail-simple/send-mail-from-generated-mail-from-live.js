/**
 * ------------------------------------------------------------------
 * FILE: send-mail-from-generated-mail-from-live.js
 * PURPOSE: This script is used by the Live Console (Port 80) to send outbound emails.
 * CAPABILITIES:
 *  - Live to Live: Can send emails from a generated address (e.g. abc@llamerada.online) to public services like Gmail, Yahoo, etc.
 *  - Live to Local: Can send emails from a generated address to another generated address on the same server.
 * NOTE: Since this runs on the VPS, it requires outbound Port 25 to be unblocked by DigitalOcean to send to public domains like Gmail.
 * ------------------------------------------------------------------
 */
import nodemailer from "nodemailer";
import dns from "dns";
import util from "util";
import fs from "fs";
import path from "path";

const resolveMx = util.promisify(dns.resolveMx);

/**
 * Sends an email directly to the recipient's MX server.
 * @param {Object} options - { from, to, subject, text, html }
 */
export async function sendOutboundEmail({ from, to, subject, text, html, attachments, logCallback }) {
  const log = (msg) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  };

  if (!from || !to) {
    throw new Error("Missing 'from' or 'to' addresses");
  }

  // Extract the domain of the recipient
  const toDomain = to.split("@")[1];
  if (!toDomain) {
    throw new Error("Invalid 'to' email address");
  }

  // Look up MX records for the recipient's domain
  let mxRecords;
  try {
    log(`[OUTBOUND] Resolving MX records for ${toDomain}...`);
    mxRecords = await resolveMx(toDomain);
  } catch (error) {
    throw new Error(`Failed to resolve MX records for domain ${toDomain}: ${error.message}`);
  }

  if (!mxRecords || mxRecords.length === 0) {
    throw new Error(`No MX records found for domain ${toDomain}`);
  }

  // Sort MX records by priority (lowest number = highest priority)
  mxRecords.sort((a, b) => a.priority - b.priority);

  const targetMx = mxRecords[0].exchange;
  log(`[OUTBOUND] Target MX server selected: ${targetMx} (Priority: ${mxRecords[0].priority})`);
  log(`[OUTBOUND] Connecting to ${targetMx} on Port 25...`);

  // Create a nodemailer transporter targeting the resolved MX server
  const transporterOptions = {
    host: targetMx,
    port: 25,
    secure: false, // Port 25 usually uses STARTTLS rather than implicit TLS
    tls: {
      rejectUnauthorized: false // Allow self-signed certs (common when communicating server-to-server)
    },
    logger: {
      level: 'debug',
      trace: (meta, msg, ...args) => log(`[SMTP TRACE] ` + util.format(msg, ...args)),
      debug: (meta, msg, ...args) => log(`[SMTP DEBUG] ` + util.format(msg, ...args)),
      info: (meta, msg, ...args) => log(`[SMTP INFO] ` + util.format(msg, ...args)),
      warn: (meta, msg, ...args) => log(`[SMTP WARN] ` + util.format(msg, ...args)),
      error: (meta, msg, ...args) => log(`[SMTP ERROR] ` + util.format(msg, ...args)),
      fatal: (meta, msg, ...args) => log(`[SMTP FATAL] ` + util.format(msg, ...args))
    },
    debug: true
  };

  // Load DKIM Private Key if available
  const privateKeyPath = path.join(process.cwd(), 'backend', 'dkim-key-for-send-mail', 'private.key');
  if (fs.existsSync(privateKeyPath)) {
    log(`[OUTBOUND] DKIM private key found, signing email for domain ${from.split("@")[1]}...`);
    transporterOptions.dkim = {
      domainName: from.split("@")[1], // Sign with sender's domain
      keySelector: "default",
      privateKey: fs.readFileSync(privateKeyPath, 'utf8')
    };
  } else {
    log(`[OUTBOUND WARNING] DKIM private key not found at ${privateKeyPath}. Sending without DKIM signature.`);
  }

  const transporter = nodemailer.createTransport(transporterOptions);

  const mailOptions = {
    from,
    to,
    subject: subject || "(No Subject)",
    text: text || "",
    html: html || "",
    attachments: attachments ? attachments.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64')
    })) : []
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log(`[OUTBOUND] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    log(`[OUTBOUND ERROR] Failed to send email to ${to}: ${error.message}`);
    throw error;
  }
}
