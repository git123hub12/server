require("dotenv").config();
// Email verification handler
const nodemailer = require("nodemailer");
// Path for static verified page
const path = require("path");
const fs = require("fs");


// Nodemailer stuff , the transporter have service of gmail
// Other service transporter
const VSTransporter = nodemailer.createTransport({
    host: "smtp.titan.email",
    port: 465,
    secure: true,
    auth: {
      user: process.env.AUTH_EMAIL,
      pass: process.env.AUTH_PASS,
    },
  });
  
  // Testing success of VStransporter
  VSTransporter.verify((error, success) => {
    if (error) {
      console.log("error in vs transporter => ", error);
    } else {
      console.log("Ready for messages");
      console.log("success message", success);
    }
});


// Send welcome email
const sendWelcomeEmail = async ({ _id, email, fullname }, callback) => {
    const filePath = path.join(__dirname, "./../../views/welcomeEmail.html");
    console.log(`inside welcome email function email is ${email} and fullname ${fullname}`);
    // Read the HTML file content
    const htmlContent = fs.readFileSync(filePath, "utf-8");
    const personalizedHtmlContent = htmlContent
      .replace("qurenoteusername", fullname)
      .replace("qurenoteuseremail", email);
  
    const mailOptions = {
      from: process.env.AUTH_EMAIL,
      to: email,
      subject: "Welcome to QureNote.AI",
      html: personalizedHtmlContent,
    };
  
    if (email) {
      VSTransporter.sendMail(mailOptions)
        .then((resp) => {
          console.log("welcome mail sent",resp);
          callback(null, email);
        })
        .catch((error) => {
          callback(error);
        });
    } else {
      callback(new Error("No email provided"));
    }
};

module.exports = {sendWelcomeEmail};