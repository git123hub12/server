const express = require("express");
const router = express.Router();
const fs = require("fs");
const passport = require("../passportAuth/passport");
require("../passportAuth/manualAuth");

// MongoDB user model
const User = require("../models/User.model");
const UserDetails = require("../models/userDetails.model"); // Ensure correct file path
// MongoDB user verification model
const UserVerification = require("../models/userVerfication.model");
// Email verification handler
const nodemailer = require("nodemailer");
// Unique string
const { v4: uuidv4 } = require("uuid");
// Env variables
require("dotenv").config();
// Path for static verified page
const path = require("path");
const jwt = require("jsonwebtoken");
const Session = require("../models/Session.model");

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
// Password handler
const bcrypt = require("bcrypt");
const { info } = require("console");
const createTokens = require("../utils/createTokens");
const setTokensCookies = require("../utils/setTokensCookies");



router.post("/signup", async (req, res) => {
  try {
    const {
      fullName,
      password,
      firstName,
      lastName,
      contact: email,
      dateOfBirth // Ensure this field is included if required
    } = req.decryptedUserData;

    const accountname = fullName.trim();
    console.log("accountname in User js file ", accountname);
    const trimmedEmail = email.trim();
    console.log("trimmedEmail in User js file ", trimmedEmail); 
    const trimmedPassword = password.trim();
    console.log("trimmedPassword in User js file ", trimmedPassword);

    if (!accountname || !trimmedEmail || !trimmedPassword ) {
      return res.json({
        status: "FAILED",
        message: "Empty input fields!",
      });
    }

    if (!/^[A-Za-z0-9\s]+$/.test(firstName)) {
      return res.json({
        status: "FAILED",
        message: "Invalid first name entered",
      });
    }

    if (!/^[A-Za-z0-9\s]+$/.test(lastName)) {
      return res.json({
        status: "FAILED",
        message: "Invalid last name entered",
      });
    }

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(trimmedEmail)) {
      return res.json({
        status: "FAILED",
        message: "Invalid email entered",
      });
    }

    if (trimmedPassword.length < 8) {
      return res.json({
        status: "FAILED",
        message: "Password is too short!",
      });
    }

    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.json({
        status: "FAILED",
        message: "User with provided email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    // const userDetail = new UserDetails({
    //   firstName,
    //   lastName,
    //   fullName: accountname,
    //   email: trimmedEmail
    // });

    const newUser = new User({
      fullname: accountname,
      email: trimmedEmail,
      password: hashedPassword,
      dateOfBirth, // Ensure this field is included if required
      // userDetail: savedUserDetail._id,
      verified: false,
    });

    const result = await newUser.save();
    res.json({
      status: "PENDING",
      message: "An email has been sent!",
    });
    sendVerificationEmail(result, res);
  } catch (err) {
    console.error("Error in /signup route:", err);
    res.json({
      status: "FAILED",
      message: "An error occurred during signup",
    });
  }
});


// Send verification email
const sendVerificationEmail = ({ _id, email, fullname }, res) => {
  const uniqueString = uuidv4() + _id;
  const filePath = path.join(__dirname, "./../views/verificationEmail.html");

  // Read the HTML file content
  const htmlContent = fs.readFileSync(filePath, "utf-8");
  const emailLink = `${currentServerUrl}/api/user/verify/${_id}/${uniqueString}`;
  
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
            .then((resp) => {
              console.log("verification email sent",resp);
            })
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
router.get("/verify/:userId/:uniqueString", async (req, res) => {
  let { userId, uniqueString } = req.params;

  UserVerification.find({ userId })
    .then(async (result) => {
      if (result.length > 0) {
        // User verification record exists so we proceed
        const id = result[0].userId;
        const user = await User.findOne({_id:id});
        const modifiedResult = {
          _id: result[0].userId,
          fullname: user?.fullname,
          email: user?.email,
        };
        const { expiresAt } = result[0];
        const hashedUniquestring = result[0].uniqueString;
        
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
                        let message = "An error occurred while finalizing successful verification.";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                      });
                  })
                  .catch((error) => {
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
  const filePath = path.join(__dirname, "./../views/welcomeEmail.html");
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
      .then(() => {
        callback(null, email);
      })
      .catch((error) => {
        callback(error);
      });
  } else {
    callback(new Error("No email provided"));
  }
};

// Signin route and creating jwt token after successful signin
router.post("/signin", async (req, res, next) => {
  try {
    req.body = req.decryptedUserData;
    const email = req.body.contact;
    const password = req.body.password;
    const deviceData = req.body.deviceBrand;
    const location = `${req.body.city || 'Unknown'},${req.body.state || 'Unknown'}`;

    console.log("Device Brand:", deviceData);
    const userData = await User.findOne({ email : email });
    console.log("userData",userData);
  
    if(!userData){
      return res.status(404).json({status : "FAILED",message : "Please enter a valid email!", info :{message : "Please enter a Valid email!"}});
    }
    else if(userData.google?.id){
      return res.status(400).json({status : "FAILED",message : "you are already signed-up with google account"});
    }else if(userData.facebook?.id){
      return res.status(400).json({status : "FAILED",message : "you are already signed-up with facebook account"});
    }
    else if(!userData.verified){
      return res.status(404).json({status : "FAILED",message : "user not verified", info : {message : "Email hasn't been verified yet. Check your inbox."}});
    }
    else if(userData && (await bcrypt.compare(password,userData.password))){
      console.log("Password verified");
      const {accessToken, refreshToken} = await createTokens(userData._id);
      setTokensCookies(res,accessToken,refreshToken);
      const sessionOfUser = uuidv4(); 
      const status = "true"
      const data = {
        user : {
          email : userData.email,
          isSubscribed : userData.isSubscribed,
          fullname : userData.fullname,
          id : userData._id,
          SessionId : sessionOfUser
        }
      }
      
      const session = new Session({
        userId: userData._id,
        deviceInfo:deviceData,
        ip:location,
        session: sessionOfUser,
        active:status
      });
      // saving to session
      await session.save();

      return res.status(200).json({status : "SUCCESS", message : "Authentication successful", data, token : accessToken });
    }else{
      return res.status(400).json({status : "FAILED", message : "Invalid credentials",info : {message : "Invalid Credentials!"}});
    }
  } catch (error) {
    console.log("error in log in",error);
    return res.status(500).json({status : "FAILED",message : "Internal server Error"});
  }
});

module.exports = router;

