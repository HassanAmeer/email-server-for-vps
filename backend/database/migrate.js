import { Database } from "bun:sqlite";
import path from "path";

const dbPath = path.join(process.cwd(), "backend", "storage", "email_logs.sqlite");
console.log("Opening db at", dbPath);
const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE mailbox RENAME TO mailbox_table;");
  console.log("Successfully renamed table mailbox to mailbox_table.");
} catch (e) {
  try {
    db.exec("ALTER TABLE mailbox_users RENAME TO mailbox_table;");
    console.log("Successfully renamed table mailbox_users to mailbox_table.");
  } catch (e2) {
    try {
      db.exec("ALTER TABLE webmail_users RENAME TO mailbox_table;");
      console.log("Successfully renamed table webmail_users to mailbox_table.");
    } catch (e3) {
      console.log("Tables already renamed to mailbox_table.");
    }
  }
}
