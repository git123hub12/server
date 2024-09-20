const jwt = require('jsonwebtoken');
const verifyRefreshToken = require('./verifyRefreshToken');
const createTokens = require('./createTokens');
const UserRefreshTokenModel = require('../models/UserRefreshToken.model');
require("dotenv").config();

const refreshAccessToken = async (req, res) => {
  try {
    // Get refresh token from cookies
    const oldRefreshToken = req.cookies.refreshToken;

    // Verify refresh token
    const { tokenDetails, error} = await verifyRefreshToken(oldRefreshToken);
    
    if (error) {
      return res.status(401).send({ status: "failed", message: "Invalid refresh token" });
    }
    // Find User based on Refresh Token detail id 
    const user = await UserModel.findById(tokenDetails.id)

    if (!user) {
      return res.status(404).send({ status: "failed", message: "User not found" });
    }

    const userRefreshToken = await UserRefreshTokenModel.findOne({ userId: tokenDetails.id })

    if (oldRefreshToken !== userRefreshToken.token || userRefreshToken.blacklisted) {
      return res.status(401).send({ status: "failed", message: "Unauthorized access" });
    }

    // Generate new access and refresh tokens
    const { accessToken, refreshToken } = await createTokens(user._id);
    return {
      newAccessToken: accessToken,
      newRefreshToken: refreshToken,
    };

  } catch (error) {
    console.error(error);
    return res.status(500).send({ status: "failed", message: "Internal server error" });
  }
};

module.exports = refreshAccessToken;
