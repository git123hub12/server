const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models/User.model");
require("dotenv").config();

var opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.CREATE_TOKEN_SECRET
};
// this is jwt strategy from passport it is used as middleware for the protected api end point. It will extract the user from token and pass to next call
passport.use(new JwtStrategy(opts,async (jwt_payload,done)=>{
    try{
        const user = await User.findOne({_id : jwt_payload.id}).select('-password');
        if(user){
            return done(null,user);
        }else{
            return done(null,false);
        }
    }catch(err){
        return done(err,false);
    }
}))