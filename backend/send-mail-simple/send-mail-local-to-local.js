import nodemailer from "nodemailer";

// Local SMTP server se connect karein jo port 2525 par chal raha hai
const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 2525,
  secure: false, // TLS local testing ke liye required nahi hai
  tls: {
    rejectUnauthorized: false
  }
});

const mailOptions = {
  from: '"Test Sender" <sender@example.com>',
  to: 'receiver@tempemail.com',
  subject: "Testing Local SMTP Server",
  text: "Hello! This is a plain text body from local testing script.",
  html: "<b>Hello!</b> This is an HTML body from local testing script."
};

console.log("Sending test email to localhost:2525...");

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.error("❌ Error sending email:", error);
  }
  console.log("✅ Email sent successfully!");
  console.log("Server Response:", info.response);
});
