import net from "net";
import tls from "tls";

/**
 * Lightweight IMAP Connection & Auth Tester (Pure Node/Bun - Zero external dependencies)
 * Usage: bun backend/imap-setup/test-imap.js <host> <port> <email> <password>
 */

const host = process.argv[2] || "127.0.0.1";
const port = parseInt(process.argv[3] || "143", 10);
const email = process.argv[4] || "test@mailserver10.com";
const password = process.argv[5] || "123456";

console.log("==================================================");
console.log(`🔍 Testing IMAP Connection to ${host}:${port}`);
console.log(`👤 User: ${email}`);
console.log("==================================================");

const isTls = port === 993;
const client = isTls 
  ? tls.connect(port, host, { rejectUnauthorized: false }) 
  : net.connect(port, host);

let step = 0;

client.on("connect", () => {
  console.log(`✅ Connected successfully to IMAP server at ${host}:${port}`);
});

client.on("data", (data) => {
  const response = data.toString();
  console.log(`[SERVER] ${response.trim()}`);

  if (step === 0 && response.startsWith("* OK")) {
    step = 1;
    const loginCmd = `A01 LOGIN "${email}" "${password}"\r\n`;
    console.log(`[CLIENT] ${loginCmd.trim()}`);
    client.write(loginCmd);
  } else if (step === 1) {
    if (response.includes("A01 OK")) {
      console.log("🎉 LOGIN SUCCESSFUL!");
      step = 2;
      const selectCmd = "A02 SELECT INBOX\r\n";
      console.log(`[CLIENT] ${selectCmd.trim()}`);
      client.write(selectCmd);
    } else if (response.includes("A01 NO") || response.includes("A01 BAD")) {
      console.error("❌ Authentication Failed: Invalid email or password.");
      client.end("A03 LOGOUT\r\n");
    }
  } else if (step === 2) {
    if (response.includes("A02 OK")) {
      console.log("📬 INBOX SELECTED SUCCESSFULLY!");
      step = 3;
      client.end("A03 LOGOUT\r\n");
    } else if (response.includes("A02 NO") || response.includes("A02 BAD")) {
      console.error("❌ SELECT Failed:", response.trim());
      client.end("A03 LOGOUT\r\n");
    }
  }
});

client.on("error", (err) => {
  console.error("❌ Socket Error:", err.message);
});

client.on("end", () => {
  console.log("🔒 IMAP connection closed.");
});
