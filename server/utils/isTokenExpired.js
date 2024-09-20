const jwt = require('jsonwebtoken');
require("dotenv").config();
const isAccessTokenExpired = (token) => {
  try {
    // Verify the token with the secret key
    jwt.verify(token, process.env.CREATE_TOKEN_SECRET);
    return false; 
  } catch (error) {
    return true;
  }
};

const isRefreshTokenExprired = (token) =>{
  try {
    // Verify the token with the secret key
    jwt.verify(token, process.env.CREATE_REFRESH_TOKEN_SECRET);
    return false; 
  } catch (error) {
    return true;
  }
}
module.exports ={isAccessTokenExpired, isRefreshTokenExprired} ;
