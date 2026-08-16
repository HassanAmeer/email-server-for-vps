import net from "net";

const host = process.argv[2] || "127.0.0.1";
const port = parseInt(process.argv[3] || "110", 10);
const email = process.argv[4] || "admin@micorna.biz";
const password = process.argv[5] || "12345678";

console.log(`Testing POP3 Connection to ${host}:${port} for ${email}...`);

const client = net.connect(port, host);
let state = 0;

client.on("connect", () => {
  console.log(`✅ Connected to POP3 server at ${host}:${port}`);
});

client.on("data", (data) => {
  const msg = data.toString().trim();
  console.log(`[POP3 SERVER] ${msg}`);

  if (state === 0 && msg.startsWith("+OK")) {
    state = 1;
    client.write(`USER ${email}\r\n`);
  } else if (state === 1) {
    if (msg.startsWith("+OK")) {
      state = 2;
      client.write(`PASS ${password}\r\n`);
    } else {
      console.error("❌ USER command rejected:", msg);
      client.end();
    }
  } else if (state === 2) {
    if (msg.startsWith("+OK")) {
      state = 3;
      console.log("🎉 POP3 AUTHENTICATION SUCCESSFUL!");
      client.write("STAT\r\n");
    } else {
      console.error("❌ POP3 Password authentication failed:", msg);
      client.end();
    }
  } else if (state === 3) {
    console.log(`📊 Mailbox STAT Result: ${msg}`);
    client.write("LIST\r\n");
    state = 4;
  } else if (state === 4) {
    console.log(`📋 Mailbox LIST Result:\n${msg}`);
    client.write("QUIT\r\n");
    state = 5;
  } else if (state === 5) {
    client.end();
  }
});

client.on("error", (err) => {
  console.error("❌ POP3 Connection Error:", err.message);
});
