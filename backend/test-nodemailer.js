const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    direct: true
});
console.log("Direct transport created");
