import net from "net";

const recipient = process.argv[2] || "admin@micorna.biz";
const sender = process.argv[3] || "verification@cloudservice.com";
const subject = process.argv[4] || "Live POP3 Inbox Test for admin@micorna.biz";
const body = process.argv[5] || "Hello! This is an external email sent to admin@micorna.biz to test POP3 fetching.";

const client = net.connect(25, "127.0.0.1", () => {
  console.log("Connected to local SMTP port 25");
});

let step = 0;
client.on("data", (data) => {
  const resp = data.toString();
  console.log("SMTP:", resp.trim());
  if (step === 0 && resp.startsWith("220")) {
    step = 1;
    client.write("HELO micorna.biz\r\n");
  } else if (step === 1 && resp.startsWith("250")) {
    step = 2;
    client.write(`MAIL FROM:<${sender}>\r\n`);
  } else if (step === 2 && resp.startsWith("250")) {
    step = 3;
    client.write(`RCPT TO:<${recipient}>\r\n`);
  } else if (step === 3 && resp.startsWith("250")) {
    step = 4;
    client.write("DATA\r\n");
  } else if (step === 4 && resp.startsWith("354")) {
    step = 5;
    const raw = `From: ${sender}\r\nTo: ${recipient}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <${Date.now()}@micorna.biz>\r\n\r\n${body}\r\n.\r\n`;
    client.write(raw);
  } else if (step === 5 && resp.startsWith("250")) {
    console.log("✅ EMAIL DELIVERED SUCCESSFULLY TO SMTP!");
    client.write("QUIT\r\n");
    step = 6;
  } else if (step === 6) {
    client.end();
  }
});
