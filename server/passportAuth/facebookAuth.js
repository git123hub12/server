const router = require("express").Router();
const passport = require("passport");
const User = require("../models/User.model");
const createTokens = require("../utils/createTokens");

// setting server and client url based on Env

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
// router.get("/login/success", (req, res) => {
//     if (req.user) {
// const token = createToken();
//         res.status(200).json({
//             error: false,
//             message: "Successful logged in",
//             user: req.user,
//             token
//         });
//     } else {
//         res.status(403).json({ error: true, message: "Not Authorized" });
//     }
// });

router.get("/login/failed", (req, res) => {
    res.status(401).json({
        error: true,
        message: "Log in Failure",
    });
    console.error('login failed- test:', err);
});

// Facebook authentication routes
router.get("/facebook", passport.authenticate("facebook",{ session : false, scope :["email"] }));
router.get(
    "/facebook/callback",
    passport.authenticate("facebook", {
      session : false,
      // successRedirect: `${currentClientUrl}/notes`,
      // failureRedirect: "/login/failed",
      failureRedirect : `${currentClientUrl}`,
    }),
    async (req,res) =>{
      try {
        console.log("Inside facebook callback");
        const fbUser = req.user;
        const email = fbUser.emails[0].value;
        if(!email){
          return res.status(400).json({success : "FAILED",message : "email is not given by facebook"});
        }
        console.log("facebook user", fbUser);
        const existingUser = await User.findOne({
          email : email,
        });
        if (existingUser) {
          if(existingUser.google?.id){
            return res.status(400).json({success : "FAILED",message : "email is already sign in with google"});
          }
          if(!existingUser.facebook?.id){
            return res.status(400).json({success : "FAILED",message : "email is already registered manually"});
          }
          const {accessToken, refreshToken} = await createTokens(existingUser._id);
          setTokensCookies(res,accessToken,refreshToken);
          return res.redirect(`${currentClientUrl}/notes?token=${accessToken}`);
        } else {
          const fbUser = req.user;
          const newUser = new User({
            fullname: fbUser._json.name,
            firstName: fbUser._json.given_name,
            lastName: fbUser._json.family_name,
            email: fbUser._json.email,
            verified: true,
            facebook:{
              id : fbUser.id,
              email : fbUser.emails[0].value,
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
        console.log("Error in fb callback",error);
      }
    }
);


router.get('/logout', (req, res) => {
    req.logout(function (err) {
      if (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({ status: 'FAILED', message: 'Error during logout' });
      }
  
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ status: 'FAILED', message: 'Error destroying session' });
        }

        return res.redirect(`${currentClientUrl}/`);
      });
    });
  });
  
module.exports = router;
