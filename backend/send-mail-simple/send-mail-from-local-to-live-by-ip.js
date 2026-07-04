import nodemailer from "nodemailer";

// VPS SMTP configuration
const VPS_IP = "64.227.137.95";
const SMTP_PORT = 2525; // Standard SMTP port for live servers. Change to 2525 if port 25 is blocked by your ISP or if VPS listens on 2525.

const transporter = nodemailer.createTransport({
  host: VPS_IP,
  port: SMTP_PORT,
  secure: false, // TLS is optional/disabled for simple SMTP routing testing
  tls: {
    rejectUnauthorized: false
  }
});

const mailOptions = {
  from: '"Live Local Tester" <tester@example.com>',
  to: 'vps-test@tempemail.com',
  subject: `Direct VPS SMTP Test — ${new Date().toLocaleTimeString()}`,
  text: "Hello! This is a test email sent from the local machine directly to the VPS SMTP server.",
  html: "<p>Hello! This is a test email sent from the local machine directly to the VPS SMTP server.</p>"
};

console.log(`Sending test email to VPS SMTP server at ${VPS_IP}:${SMTP_PORT}...`);

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("❌ Error sending email:", error);
    console.log("\n💡 TIP: If you get a connection timeout, your home ISP might be blocking outgoing port 25. Try changing SMTP_PORT to 2525 in this script (make sure port 2525 is allowed on your VPS firewall).");
    return;
  }
  console.log("✅ Email sent successfully!");
  console.log("Server Response:", info.response);
});
