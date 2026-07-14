import { Database } from "bun:sqlite";
import path from "path";

const dbPath = path.join(process.cwd(), "backend", "storage", "email_logs.sqlite");
console.log("Opening db at", dbPath);
const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE webmail_users RENAME TO mailbox_users;");
  console.log("Successfully renamed table webmail_users to mailbox_users.");
} catch (e) {
  if (e.message.includes("no such table")) {
    console.log("Table webmail_users does not exist. It may have already been renamed, or db was just recreated.");
  } else {
    console.error("Migration error:", e.message);
  }
}
