// This middleware will set Authorization Header and will refresh access token on expire
// if we use this middleware we won't have to explicitly make request to refresh-token api url

const { isAccessTokenExpired } = require("../utils/isTokenExpired");
const refreshAccessToken = require("../utils/refreshAccessToken");
const setTokensCookies = require("../utils/setTokensCookies");

const accessTokenAutoRefresh = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (accessToken && !isAccessTokenExpired(accessToken)) {
      //  Add the access token to the Authorization header
      req.headers["authorization"] = `Bearer ${accessToken}`;
    }

    if (!accessToken || isAccessTokenExpired(accessToken)) {
      // Attempt to get a new access token using the refresh token
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        // If refresh token is also missing, throw an error
        return res.status(401).json({
          error: "Unauthorized",
          message: "Access token is missing or invalid",
        });
      }
      // Access token is expired, make a refresh token request
      const { newAccessToken, newRefreshToken } = await refreshAccessToken(req,res);

      // set cookies
      setTokensCookies(res, newAccessToken, newRefreshToken);

      //  Add the access token to the Authorization header
      req.headers["authorization"] = `Bearer ${newAccessToken}`;
    }
    next();
  } catch (error) {
    console.error("Error adding access token to header:", error.message);
    // Handle the error, such as returning an error response or redirecting to the login page
    return res.status(401).json({
      error: "Unauthorized",
      message: "Access token is missing or invalid",
    });
  }
};

module.exports = accessTokenAutoRefresh;
