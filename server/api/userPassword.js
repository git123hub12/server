const express = require("express");
const router = express.Router();
const fs = require("fs");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// MongoDB models
const User = require("../models/User.model");
// const PasswordResetToken = require('../models/PasswordResetToken.model'); // this needs to be looked into

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",
  port: 465,
  secure: true,
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// Verify transporter setup
transporter.verify((error, success) => {
  if (error) {
    console.log("Error in transporter verification:", error);
  } else {
    console.log("Transporter ready for sending emails");
  }
});

// Function to send reset password email
const sendResetPasswordEmail = (user, email, resetToken, res) => {

  console.log(user._id);
  
  const filePath = path.join(__dirname, "./../views/forgotPassword.html");
  
  const htmlContent = fs.readFileSync(filePath, "utf-8");
  const resetLink = `${process.env.AWS_CLIENT_URL}/resetpassword?userId=${user._id}&token=${resetToken}`;
  // const resetLink = `${process.env.CLIENT_URL}/resetpassword?userId=${user._id}&token=${resetToken}`;
  const personalizedHtmlContent = htmlContent
    .replace("qurenoteusername", user.fullname)
    .replace("/{{link}}/g", resetLink)
    .replace(/{{link}}/g, resetLink)
    // .replace("qurenoteuseremail", email);
  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Reset Your Password",
    html: personalizedHtmlContent,
    // html: `<p>You have requested to reset your password. Click <a href="${resetLink}">here</a> to reset your password.</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending reset password email:", error);
      res.status(500).json({
        status: "FAILED",
        message: "Failed to send reset password email",
      });
    } else {
      console.log("Reset password email sent:", info.response);
      res.status(200).json({
        status: "SUCCESS",
        message: "Reset password email sent successfully",
      });
    }
  });
};

// Route to request password reset
router.post("/request-reset", async (req, res) => {
  
  const { email } = req.body.email;
  try {
    console.log("email use:", email);
    const user = await User.findOne({email});
    if(!user){
      return res.status(404).json({status : "FAILED", message : "User not found"});
    }
    if(user){
      if(user.google?.id){
        return res.status(404).json({status : "FAILED", message : "User registerd with google"});
      }
      else if(user.facebook?.id){
        return res.status(404).json({status : "FAILED", message : "User registerd with facebook"});
      }
      else{
        //generate reset token 
        const resetToken = uuidv4();
        sendResetPasswordEmail(user, email, resetToken, res);
      }
    }
  } catch (error) {
    console.log("error in reset password",error);
    return res.status(500).json({status : "FAILED",message : "Failed to find user"});
  }


  // User.findOne({ email })
  //   .then((user) => {
  //     if (!user) {
  //       console.log("user not there");
  //       return res
  //         .status(404)
  //         .json({ status: "FAILED", message: "User not found" });
  //     }

  //     // Generate reset token
  //     const resetToken = uuidv4();

  //     sendResetPasswordEmail(user, email, resetToken, res);
  //   })
  //   .catch((error) => {
  //     console.log("Error finding user:", error);
  //     res
  //       .status(500)
  //       .json({ status: "FAILED", message: "Failed to find user" });
  //   });
});

// Route to reset password
router.post("/reset", (req, res) => {
  console.log("inside reset");
  console.log(req.body.url);
  const password = req.body.password;
  const url = req.body.url;
  const userIdMatch = url.match(/userId=([^&]+)/);
  const _id = userIdMatch ? userIdMatch[1] : null;


  User.findOne({ _id })
    .then((user) => {
      if (!user) {
        return res
          .status(404)
          .json({ status: "FAILED", message: "User not found" });
      }
      
      // Password hashing
      const saltRounds = 10;
      console.log("user found")
      bcrypt
        .hash(password, saltRounds)
        .then((hashedPassword) => {
          // Update user's password
          User.findByIdAndUpdate(_id, { password: hashedPassword })
            .then(() => {
              console.log("PASSWORD UPDATED");
              res.status(200).json({
                status: "SUCCESS",
                message: "Password updated successfully",
              });
            })
            .catch((error) => {
              console.log("Error updating user's password:", error);
              res.status(500).json({
                status: "FAILED",
                message: "Failed to update password",
              });
            });
        })
        .catch((error) => {
          console.log("Error hashing new password:", error);
          res
            .status(500)
            .json({ status: "FAILED", message: "Failed to hash new password" });
        });
    })
    .catch((error) => {
      console.log("Error finding user:", error);
      res
        .status(500)
        .json({ status: "FAILED", message: "Failed to find user" });
    });
});

router.post('/page-reset', (req, res) => {
  const { currentpassword, password, id: _id } = req.body;
  const saltRounds = 10;
  if (currentpassword===password){
    return res.status(404).json({ status: 'FAILED', message: 'Your new password cannot be the same as your current password.' });
  }

  User.findOne({ _id })
    .then((user) => {
      if (!user) {
        return res.status(404).json({ status: 'FAILED', message: 'User not found' });
      }

      // Verify the current password
      bcrypt.compare(currentpassword, user.password)
        .then((isMatch) => {
          if (!isMatch) {
            return res.status(400).json({ status: 'FAILED', message: 'Current password is incorrect' });
          }

          // Hash the new password
          bcrypt.hash(password, saltRounds)
            .then((hashedPassword) => {
              // Update user's password
              User.findByIdAndUpdate(_id, { password: hashedPassword })
                .then(() => {
                  console.log('PASSWORD UPDATED');
                  res.status(200).json({
                    status: 'SUCCESS',
                    message: 'Password updated successfully',
                  });
                })
                .catch((error) => {
                  console.error('Error updating password:', error);
                  res.status(500).json({
                    status: 'FAILED',
                    message: 'Error updating password',
                  });
                });
            })
            .catch((error) => {
              console.error('Error hashing password:', error);
              res.status(500).json({
                status: 'FAILED',
                message: 'Error hashing password',
              });
            });
        })
        .catch((error) => {
          console.error('Error comparing passwords:', error);
          res.status(500).json({
            status: 'FAILED',
            message: 'Error comparing passwords',
          });
        });
    })
    .catch((error) => {
      console.error('Error finding user:', error);
      res.status(500).json({
        status: 'FAILED',
        message: 'Error finding user',
      });
    });
});

module.exports = router;
