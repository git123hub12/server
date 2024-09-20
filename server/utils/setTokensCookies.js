require("dotenv").config();
const setTokensCookies = (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.BACKEND_SERVER, 
        sameSite: 'strict', 
      });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.BACKEND_SERVER, 
        sameSite: 'strict', 
      });
    res.cookie('isLogIn',true,{
        httpOnly: true,
        secure: process.env.BACKEND_SERVER, 
        sameSite: 'strict', 
    });
    
}
module.exports = setTokensCookies;