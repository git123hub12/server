const jwt = require('jsonwebtoken');
const  UserRefreshTokenModel  = require('../models/UserRefreshToken.model');
require("dotenv").config();
 
// Function to create access and refresh tokens
const createTokens = async (id) => {
  try {
    const payload = { id: id };


    // Create an access token with a short expiration 1day
    const accessTokenOptions = {
      expiresIn: "1d",
    };
    const accessToken = jwt.sign(payload, process.env.CREATE_TOKEN_SECRET, accessTokenOptions);

    // Create a refresh token with a longer expiration 7 days
    const refreshTokenOptions = {
      expiresIn: "7d",
    };
    const refreshToken = jwt.sign(payload, process.env.CREATE_REFRESH_TOKEN_SECRET, refreshTokenOptions);
    const userRefreshToken = await UserRefreshTokenModel.findOneAndDelete({ userId: id });
    
    await new UserRefreshTokenModel({userId: id , token:refreshToken}).save();

    return Promise.resolve({accessToken,refreshToken});
  } catch (error) {
    return Promise.reject(error);
  }

}
module.exports = createTokens;

  