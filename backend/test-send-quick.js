import { sendOutboundEmail } from "./send-mail-simple/send-mail-from-generated-mail-from-local.js";

async function run() {
  try {
    await sendOutboundEmail({
      from: "yaar@llamerada.online",
      to: "hasanameer386@gmail.com",
      subject: "Test from DNS updated local",
      text: "This is a test to see if the DNS changes (SPF and p=none DMARC) worked!",
      logCallback: (msg) => console.log(msg)
    });
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Failed to send:", err.message);
  }
}

run();
