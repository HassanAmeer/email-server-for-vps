import db from "./backend/database/db.js";
db.prepare("DELETE FROM received_emails").run();
db.prepare("DELETE FROM generated_emails").run();
console.log("Database cleared successfully!");
