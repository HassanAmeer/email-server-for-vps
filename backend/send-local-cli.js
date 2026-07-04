/**
 * ------------------------------------------------------------------
 * FILE: send-local-cli.js
 * PURPOSE: A Command Line Interface (CLI) tool for sending emails directly from the terminal.
 * CAPABILITIES: 
 *  - Local to Live: Send emails to any valid external email address (Gmail, Yahoo, etc.).
 *  - Local to Local: Send emails to any generated custom domain email address.
 * HOW IT WORKS: Prompts the user for From, To, Subject, and Message, and then uses the local sending script (`send-mail-from-generated-mail-from-local.js`) to dispatch the email.
 * ------------------------------------------------------------------
 */
import readline from "readline";
import { sendOutboundEmail } from "./send-mail-simple/send-mail-from-generated-mail-from-local.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log("==========================================");
  console.log("🚀 Send Email From Local CLI 🚀");
  console.log("==========================================\n");

  let from = await askQuestion("1. Enter 'From' Email Address (Leave empty for yaar@llamerada.online): ");
  if (!from.trim()) {
    from = "yaar@llamerada.online";
  }

  let to = "";
  while (!to.trim()) {
    to = await askQuestion("2. Enter 'To' Email Address (Required): ");
    if (!to.trim()) {
      console.log("   ❌ 'To' address is mandatory. Please enter an email address.");
    }
  }

  const subject = await askQuestion("3. Enter Subject: ");
  const text = await askQuestion("4. Enter Message: ");
  
  rl.close();

  console.log("\n⏳ Sending email...\n");
  
  try {
    await sendOutboundEmail({
      from,
      to,
      subject,
      text,
      html: text.replace(/\n/g, '<br>'),
      logCallback: (msg) => console.log(msg)
    });
    console.log("\n✅ Email sent successfully from Local Machine!");
  } catch (error) {
    console.error("\n❌ Failed to send email:", error.message);
  }
}

main();
