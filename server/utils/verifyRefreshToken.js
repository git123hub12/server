const  UserRefreshTokenModel  = require("../models/UserRefreshToken.model");
require("dotenv").config();
const verifyRefreshToken = async (refreshToken) =>{
 try{
   // Find the refresh token document
   const userRefreshToken = await UserRefreshTokenModel.findOne({ token: refreshToken });
   if(!userRefreshToken){
    return { error: true, message: "Invalid refresh token" };
   }
   
    const tokenDetails = jwt.verify(refreshToken, process.env.CREATE_REFRESH_TOKEN_SECRET);
    return { 
        tokenDetails, error:false, message: "Valid refresh Token"
    }

 }
 catch(error){
    return { error: true, message: "Invalid refresh token" };
 }
}
module.exports = verifyRefreshToken;