const router = require("express").Router();
const passport = require("passport");
const UserDetails = require("../models/userDetails.model");
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const User = require("../models/User.model");
const { google } = require("@google-cloud/speech/build/protos/protos");
const { sendWelcomeEmail } = require("../controllers/mailControllers/mailControllers");
const Session = require("../models/Session.model")
const { v4: uuidv4 } = require("uuid");
const QurenoteUser = require("../models/User.model");
const createTokens = require("../utils/createTokens");
const setTokensCookies = require("../utils/setTokensCookies");
const accessTokenAutoRefresh = require("../middleware/accessTokenAutoRefresh");

// setting server and client url based on Env

const currentClientUrl = process.env.BACKEND_SERVER ==="true"
    ? process.env.AWS_CLIENT_URL
    : (process.env.DEV_SERVER ==="true" && process.env.BACKEND_SERVER==='false')
    ? process.env.DEV_CLIENT_URL
    : process.env.CLIENT_URL;

//const currentServerUrl = process.env.BACKEND_SERVER === 'true' ? process.env.AWS_SERVER_URL : process.env.SERVER_URL;


// for session less google authentication after redirecting to the client url this api end point will return response of user and token to save it on local storage.

let first; // Variable to store the sessionId

const createAndSaveSession = async (userId, deviceInfo, ipAddress) => {
  if (!first) { // Check if `first` is not defined
    const sessionId = uuidv4();
    const newSession = new Session({
      userId,
      deviceInfo, // Use actual device info provided
      ip: ipAddress, // Use actual IP address provided
      session: sessionId,
    });

    await newSession.save();
    first = sessionId; // Store the newly created sessionId
    return sessionId;
  } else {
    const second = first;
    first = undefined;
    return second; // Return the existing sessionId
  }
};



router.post("/login/success",accessTokenAutoRefresh, passport.authenticate('jwt',{session:false}), async(req, res) => {
   if (req.user) {
     const token = req.headers.authorization.substring(7);
    // const deviceInfo = `${deviceBrand} ${deviceModel}`;
    const deviceInfo = req.body.Info;
    const ipAddress = req.body.ip;

    const displaySession = await createAndSaveSession(req.user._id, deviceInfo, ipAddress);


     const data = {
       user : {
         email : req.user.email,
         isSubscribed : req.user.isSubscribed,
         fullname : req.user.fullname,
         id : req.user._id,
         SessionId:displaySession,
         login:"google",
       }
     }
     res.status(200).json({
       error: false,
       message: "Successfully Loged In",
       data,
       token,
     });
   } else {
     res.status(403).json({ error: true, message: "Not Authorized" });
   }
 });

router.get("/login/failed", (req, res) => {
  res.status(401).json({
    error: true,
    message: "Log in failure",
  });
});

router.get("/google", passport.authenticate("google", {session : false, scope : ["profile", "email"] }));
// After successful login through google it will create jwt token for user and attach to the search params of redirect url which is /notes
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session : false,
    // failureRedirect: "/login/failed",
    failureRedirect: `${currentClientUrl}`,
  }),
  async (req, res) => {
    try {
      // After successful authentication, req.user contains the authenticated user
      const user1 = req.user;
      const { profile, accessToken } = req.user;
      // Check if the user exists in your database
      const existingUser = await User.findOne({
        email: user1.emails[0].value,
      });

      if (existingUser) {
        if(!existingUser.google?.id){
          console.log("do manual sign in");
          // return res.redirect(`${currentClientUrl}`);
          return res.status(400).json({success : "FAILED",message : "email is already registered try sign in using your credentials"});
        }
        if(existingUser.facebook?.id){
          return res.status(400).json({success : "FAILED",message : "email is already sign in facebook"});
        }
        const {accessToken,refreshToken} = await createTokens(existingUser._id);
        setTokensCookies(res,accessToken,refreshToken);
        return res.redirect(`${currentClientUrl}/notes?token=${accessToken}`);
      } else {
        const user = req.user;
        const newUser = new User({
          fullname: user._json.name,
          firstName: user._json.given_name,
          lastName: user._json.family_name,
          email: user._json.email,
          verified: true,
          google:{
            id : user.id,
            email : user.emails[0].value,
          }
        });
        const savedUser = await newUser.save();
        const {accessToken,refreshToken} = await createTokens(savedUser._id);
        setTokensCookies(res,accessToken,refreshToken);
        const modifiedResult = {
          _id : savedUser._id,
          fullname : savedUser.fullname,
          email : savedUser.email,
        }
        await sendWelcomeEmail(modifiedResult, (error, email) => {
          if (error) {
            console.error("Error sending welcome email:", error);
            // return res.status(500).send("Internal Server Error");
          }
          console.log("Welcome email sent to:", email);
          // res.status(200).send("Welcome email sent successfully");
        });             
        req.user = newUser;
        return res.redirect(`${currentClientUrl}/notes?token=${accessToken}`);
      }
    } catch (error) {
      // Handle any errors that occur during the process
      console.error("Error in Google callback route:", error);
      return res
        .status(500)
        .json({ error: true, message: "Internal server error" });
    }
  }
);

router.post("/logout", async (req, res) => {
  const { SessionId } = req.body; // Ensure you get userId from req.body
  
  try {
    // removing the cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.clearCookie("isLogIn");
    // Delete the sessions from the database
    await Session.updateOne(
      { session: SessionId },
      { $set: { expiry: new Date(Date.now() + 86400000), active: "false" } }
    );
    // Logout the user

    req.logout(function (err) {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ status: "FAILED", message: "Error during logout" });
      }

      // Destroy the session
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ status: "FAILED", message: "Error destroying session" });
        }
        return res.status(200).json({ status: "SUCCESS", message: "Logged out successfully" });
      });
    });
  } catch (error) {
    console.error("Error during session deletion or logout:", error);
    return res.status(500).json({ status: "FAILED", message: "Error during session deletion or logout" });
  }
});

router.get('/fetchSession/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ status: 'FAILED', message: 'Invalid User ID' });
    }
    const typeoflogin = await QurenoteUser.findOne({ _id: userId }).select('google facebook');
    const sessions = await Session.find({ userId: userId })
      .select('deviceInfo ip timestamp active') // Select only necessary fields
      .sort({ timestamp: -1 }); // Sort by most recent login first
    let logintype;
    if (typeoflogin?.google?.id) {
      // Facebook Login user
        logintype = 'Google Login user';
      } else if (typeoflogin?.facebook?.id) {
        logintype = 'Facebook Login user';
        
      }
    const response = { sessions };
    console.log("this is the loginnntype from server",logintype)
      if (logintype) {
        response.logintype = logintype;
      }
    res.json(response);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ status: 'FAILED', message: 'Error fetching active sessions' });
  }
});

module.exports = router;
