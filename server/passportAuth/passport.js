const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const UserDetails = require("../models/userDetails.model");

// Google authentication
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // callbackURL: "http://localhost:8000/api/auth/google/callback",
      callbackURL: "/api/auth/google/callback",
      scope: ["profile", "email"],
    },
    function (accessToken, refreshToken, profile, callback) {
      callback(null, profile,accessToken);
    }
  )
);

// Facebook authentication
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
       callbackURL: "https://qurenote.com/api/auth/facebook/callback",
      // callbackURL: "http://localhost:8000/api/auth/facebook/callback",
      //callbackURL: "/api/auth/facebook/callback",
      profileFields: ["id", "displayName", "email"],
    },
    function (accessToken, refreshToken, profile, callback) {
      callback(null, profile);
    }
  )
);


module.exports = passport;
