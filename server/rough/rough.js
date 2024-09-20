const express = require("express");
const router = express.Router();
const fs = require("fs");
const passport = require("passport");
require("../passportAuth/manualAuth"); // Ensure correct file path
// MongoDB user model
const User = require("../models/User.model");
const UserDetail = require("../models/UserDetail.model"); // Ensure correct file path
// MongoDB user verification model
const UserVerification = require("../models/UserVerification.model");
// Email verification handler
const nodemailer = require("nodemailer");
// Unique string
const { v4: uuidv4 } = require("uuid");
// Env variables
require("dotenv").config();
// Path for static verified page
const path = require("path");
const jwt = require("jsonwebtoken");

const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.CREATE_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};

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

// Setting server and client URL based on Env
const currentClientUrl = process.env.BACKEND_SERVER ==="true"
    ? process.env.AWS_CLIENT_URL
    : (process.env.DEV_SERVER ==="true" && process.env.BACKEND_SERVER==='false')
    ? process.env.DEV_CLIENT_URL
    : process.env.CLIENT_URL;
const currentServerUrl = process.env.BACKEND_SERVER === "true"
    ? process.env.AWS_SERVER_URL
    : (process.env.DEV_SERVER==="true" && process.env.BACKEND_SERVER==='false')
    ? process.env.DEV_SERVER_URL
    : process.env.SERVER_URL;
console.log("CurrentClientUrl in User js file is ", currentClientUrl);
console.log("CurrentServerUrl in User js file is ", currentServerUrl);
// Password handler
const bcrypt = require("bcrypt");

router.post("/signup", (req, res) => {
  let {
    fullName,
    password,
    firstName,
    lastName,
    contact, // Adjusted variable for email
    dateOfBirth // Added dateOfBirth as it is required in the schema
  } = req.decryptedUserData;

  const accountname = fullName.trim();
  const email = contact.trim();
  password = password.trim();

  if (!accountname || !email || !password || !dateOfBirth) {
    res.json({
      status: "FAILED",
      message: "Empty input fields!",
    });
  } else if (!/^[a-zA-Z ]*$/.test(firstName)) {
    res.json({
      status: "FAILED",
      message: "Invalid first name entered",
    });
  } else if (!/^[a-zA-Z ]*$/.test(lastName)) {
    res.json({
      status: "FAILED",
      message: "Invalid last name entered",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({
      status: "FAILED",
      message: "Invalid email entered",
    });
  } else if (password.length < 8) {
    res.json({
      status: "FAILED",
      message: "Password is too short!",
    });
  } else {
    // Checking if user already exists
    User.find({ email })
      .then((result) => {
        if (result.length) {
          res.json({
            status: "FAILED",
            message: "User with provided email already exists",
          });
        } else {
          // Password hashing
          const saltRounds = 10;
          bcrypt
            .hash(password, saltRounds)
            .then((hashedPassword) => {
              const userDetail = new UserDetail({
                firstName,
                lastName,
                email
              });

              userDetail.save()
                .then((savedUserDetail) => {
                  const newUser = new User({
                    fullname: accountname,
                    email: email,
                    password: hashedPassword,
                    dateOfBirth,
                    userDetail: savedUserDetail._id, // Reference the userDetail ID
                    verified: false,
                  });

                  newUser
                    .save()
                    .then((result) => {
                      res.json({
                        status: "PENDING",
                        message: "An email has been sent!",
                      });
                      sendVerificationEmail(result, res);
                    })
                    .catch((err) => {
                      res.json({
                        status: "FAILED",
                        message: "An error occurred while saving user account details!",
                      });
                    });
                })
                .catch((err) => {
                  res.json({
                    status: "FAILED",
                    message: "An error occurred while saving user details!",
                  });
                });
            })
            .catch((err) => {
              res.json({
                status: "FAILED",
                message: "An error occurred while hashing password!",
              });
            });
        }
      })
      .catch((err) => {
        console.log("Error in api/User.js => ", err);
        res.json({
          status: "FAILED",
          message: "An error occurred while checking for existing user!",
        });
      });
  }
});



// Send verification email
const sendVerificationEmail = ({ _id, email, fullname }, res) => {
  console.log("After redirect inside sendVerificationEmail");

  const uniqueString = uuidv4() + _id;
  const filePath = path.join(__dirname, "./../views/verificationEmail.html");

  // Read the HTML file content
  const htmlContent = fs.readFileSync(filePath, "utf-8");
  const emailLink = `${currentServerUrl}/api/user/verify/${_id}/${uniqueString}`;
  console.log("emailLink in User js file sendVerificationEmail function ", emailLink);
  
  // Replace strings in the welcome email HTML to user-specific values
  const personalizedHtmlContent = htmlContent
    .replace("qurenoteusername", fullname)
    .replace("/{{link}}/g", emailLink)
    .replace(/{{link}}/g, emailLink)
    .replace("qurenoteuseremail", email);

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Verify Your Email",
    html: personalizedHtmlContent,
  };

  // Hash the uniqueString
  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniquestring) => {
      const newVerification = new UserVerification({
        userId: _id,
        fullname: fullname,
        uniqueString: hashedUniquestring,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });
      // Saving the verification to database with 6 hrs timeout
      newVerification
        .save()
        .then(() => {
          VSTransporter.sendMail(mailOptions)
            .then(() => {})
            .catch((error) => {
              console.log("Error while sending verification email => ", error);
            });
        })
        .catch((error) => {
          console.log("Error while saving verification email data => ", error);
        });
    })
    .catch(() => {
      console.log("An error occurred while hashing email data!");
    });
};

// Resend verification link
router.post("/resendVerificationLink", async (req, res) => {
  try {
    let { userId, email } = req.body;

    if (!userId || !email) {
      throw Error("Empty user details are not allowed");
    } else {
      // Delete existing records and resend
      await UserVerification.deleteMany({ userId });
      sendVerificationEmail({ _id: userId, email }, res);
    }
  } catch (error) {
    res.json({
      status: "FAILED",
      message: `Verification Link Resend Error. ${error.message}`,
    });
  }
});

// Verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
  let { userId, uniqueString } = req.params;

  UserVerification.find({ userId })
    .then((result) => {
      if (result.length > 0) {
        // User verification record exists so we proceed
        const modifiedResult = {
          _id: result[0].userId,
          fullname: result[0].fullname,
          email: result[0].email,
        };

        const { expiresAt } = result[0];
        const hashedUniquestring = result[0].uniqueString;
        console.log(expiresAt < Date.now(), result[0]);
        
        // Checking for expired unique string
        if (expiresAt < Date.now()) {
          // Record has expired so we delete it
          UserVerification.deleteOne({ userId })
            .then(() => {
              let message = "Link has expired. We have sent another verification link.";
              sendVerificationEmail(modifiedResult, res);
              return res.render("verified.html", { error: true, message });
            })
            .catch((error) => {
              console.log("Error while checking record expiration => ", error);
              let message = "An error occurred while clearing expired user verification record";
              res.redirect(`/user/verified/error=true&message=${message}`);
            });
        } else {
          // Valid record exists so we validate the user string
          bcrypt
            .compare(uniqueString, hashedUniquestring)
            .then((result) => {
              if (result) {
                // String match
                UserVerification.deleteOne({ userId });

                User.findOneAndUpdate({ _id: userId }, { verified: true })
                  .then((doc) => {
                    UserVerification.deleteOne({ userId })
                      .then(() => {
                        modifiedResult.email = doc.email;
                        sendWelcomeEmail(modifiedResult, res, () => {
                          return res.render("verified.html", {
                            error: false,
                            message: "Your email has been verified.",
                          });
                        });
                      })
                      .catch((error) => {
                        console.log("Error finalizing successful verification => ", error);
                        let message = "An error occurred while finalizing successful verification.";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                      });
                  })
                  .catch((error) => {
                    console.log("Error while updating record => ", error);
                    let message = "An error occurred while updating user record to show verified.";
                    res.redirect(`/user/verified/error=true&message=${message}`);
                  });
              } else {
                let message = "Invalid verification details passed. Check your inbox.";
                res.redirect(`/user/verified/error=true&message=${message}`);
              }
            })
            .catch((error) => {
              let message = "An error occurred while comparing unique string";
              res.redirect(`/user/verified/error=true&message=${message}`);
            });
        }
      } else {
        let message = "Account record doesn't exist or has been verified already. Please sign up or log in.";
        res.redirect(`/user/verified/error=true&message=${message}`);
      }
    })
    .catch((error) => {
      console.log("Error inside verify email route => ", error);
      let message = "An error occurred while checking for existing user verification record";
      res.redirect(`/user/verified/error=true&message=${message}`);
    });
});

// Verified page route
router.get("/verified", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/verified.html"));
});

// Send welcome email
const sendWelcomeEmail = ({ _id, email, fullname }, res, callback) => {
  console.log("Inside SendWelcomeEmail function");

  const filePath = path.join(__dirname, "./../views/welcomeEmail.html");

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
      .then(() => {
        console.log("Welcome Email Sent");
        callback(null, email);
      })
      .catch((error) => {
        console.log("Error while sending Welcome email => ", error);
        callback(error);
      });
  } else {
    console.log("No email provided");
    callback(new Error("No email provided"));
  }
};

// Signin route using passport.authenticate
router.post("/signin", (req, res, next) => {
  req.body = req.decryptedUserData;

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
    }

    if (!user) {
      return res.json({ status: "FAILED", message: "Authentication failed", info });
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.log(loginErr);
        return res.status(500).json({ status: "FAILED", message: "Internal Server Error during login" });
      }

      const token = createToken(user._id);

      return res.json({ status: "SUCCESS", message: "Authentication successful", data: user, token });
    });
  })(req, res, next);
});

// Get user details
// router.post("/details", async (req, res, next) => {
//   req.body = req.decryptedUserData;

//   console.log("req.body =>", req.body);

//   try {
//     const user = await User.findOne({ email: req.body.email });
//     if (user) {
//       res.json({
//         status: "Success",
//         message: "User details retrieved successfully",
//         data: { fullname: user.fullname, email: user.email },
//       });
//       return;
//     }

//     const userDetail = await UserDetail.findOne({ email: req.body.email });
//     if (userDetail) {
//       res.json({
//         status: "Success",
//         message: "User details retrieved successfully",
//         data: { fullname: userDetail.fullname, email: userDetail.email },
//       });
//       return;
//     }

//     res.json({
//       status: "Failed",
//       message: "Details of user not found",
//     });
//   } catch (error) {
//     console.error("Error checking email existence:", error);
//     next(error);
//   }
// });

module.exports = router;
