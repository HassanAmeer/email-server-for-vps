import { Database } from "bun:sqlite";
import path from "path";

const dbPath = path.resolve(import.meta.dir, "storage/email_logs.sqlite");
const db = new Database(dbPath);

console.log("Setting up admin credentials in database:", dbPath);

// Ensure domain mycrona.biz exists
try {
  const existingDomain = db.prepare("SELECT * FROM attached_domains WHERE domain = ?").get("mycrona.biz");
  if (!existingDomain) {
    db.prepare(`
      INSERT INTO attached_domains (domain, status, plan, catch_all, is_primary, primary_prefix)
      VALUES (?, 'active', 'premium', 1, 1, 'admin')
    `).run("mycrona.biz");
    // unset other primary
    db.prepare("UPDATE attached_domains SET is_primary = 0 WHERE domain != 'mycrona.biz'").run();
    console.log("Added mycrona.biz as primary domain.");
  } else {
    db.prepare("UPDATE attached_domains SET is_primary = 1, primary_prefix = 'admin' WHERE domain = 'mycrona.biz'").run();
    db.prepare("UPDATE attached_domains SET is_primary = 0 WHERE domain != 'mycrona.biz'").run();
    console.log("Updated mycrona.biz as primary domain.");
  }
} catch (e) {
  console.error("Domain setup error:", e);
}

// User accounts to configure with password '12345678'
const usersToSet = [
  "admin@mycrona.biz",
  "admin@crona.biz",
  "admin@visakara.org",
  "admin@mailserver10.com",
  "support@visakara.org"
];

for (const email of usersToSet) {
  const password = "12345678";
  let hash = "12345678";
  try {
    hash = Bun.password.hashSync(password, { algorithm: "bcrypt", cost: 10 });
  } catch (e) {
    hash = password;
  }

  const existing = db.prepare("SELECT id FROM mailbox WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE mailbox SET password_hash = ?, plain_password = ? WHERE id = ?").run(hash, password, existing.id);
    console.log(`Updated user ${email} with password 12345678`);
  } else {
    db.prepare("INSERT INTO mailbox (email, password_hash, plain_password) VALUES (?, ?, ?)").run(email, hash, password);
    console.log(`Created user ${email} with password 12345678`);
  }
}

console.log("All configured users:", db.prepare("SELECT id, email, plain_password FROM mailbox").all());
console.log("All domains:", db.prepare("SELECT id, domain, is_primary FROM attached_domains").all());
