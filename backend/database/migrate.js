import { Database } from "bun:sqlite";
import path from "path";

const dbPath = path.join(process.cwd(), "backend", "storage", "email_logs.sqlite");
console.log("Opening db at", dbPath);
const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE mailbox_users RENAME TO mailbox;");
  console.log("Successfully renamed table mailbox_users to mailbox.");
} catch (e) {
  if (e.message.includes("no such table")) {
    try {
      db.exec("ALTER TABLE webmail_users RENAME TO mailbox;");
      console.log("Successfully renamed table webmail_users to mailbox.");
    } catch (e2) {
      console.log("Tables already renamed to mailbox.");
    }
  } else {
    console.error("Migration error:", e.message);
  }
}
