// mongodb
require("./config/db");
require("dotenv").config();
require("./passportAuth/passport-jwt-strategy.js");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const UserRouter = require("./api/User");
const UserDetailsRouter = require("./api/userDetails");
const express = require("express");
const port = 8000;
const passport = require("./passportAuth/passport");
const googleAuthRoute = require("./passportAuth/googleAuth");
const cernerRoute = require("./passportAuth/cernerAuth");
const facebookAuthRoute = require("./passportAuth/facebookAuth");
const session = require("express-session");
const decryptMiddleware = require("./middleware/decryptMiddleware");
const AudioRoute = require("./api/Audio");
const SOAPNoteRoute = require("./api/soapNote");
const paymentRoute = require("./api/payment");
const userPassword = require("./api/userPassword");
const stripeRoute = require('./api/stripeSubscribePayment');

const app = express();
const detail = process.env.NODE_ENV;

// Set the URLs for your client and server
const currentClientUrl = 'https://cert.qurenote.com';
const currentServerUrl = `https://cert.qurenote.com:${port}`;

// to verify signature of stripe webhooks we need unaltered raw data
app.use('/api/webhook', express.raw({ type: 'application/json' })); // this line has to be before app.use(express.json());
app.use(express.json({ limit: "100mb" }));

console.log("CurrentClientUrl in server js file is ", currentClientUrl);
console.log("CurrentServerUrl in server js file is ", currentServerUrl);

app.use(
  session({
    secret: "your-secret-key", // Replace with a random secret key
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
// app.use(passport.session());

app.use(
  cors({
    origin: currentClientUrl,
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// for cookie parser setting the cookie and removing the cookie
app.use(cookieParser());

app.use(express.static("public"));
app.set("views", __dirname + "/views");

app.engine("html", require("ejs").renderFile);

// for accepting post from data
const bodyParser = require("express").json;
app.use(bodyParser());

// Define routes
const apiRouter = express.Router();

// Routes
apiRouter.use(express.json()); // Assuming you are using JSON middleware
apiRouter.use("/user", decryptMiddleware, UserRouter);
apiRouter.use("/userDetails", UserDetailsRouter);
// google auth route
apiRouter.use("/auth", googleAuthRoute);
// cernerRouter
apiRouter.use("/auth", cernerRoute);
// facebook auth route
apiRouter.use("/auth", facebookAuthRoute);
// route for audio transcription
apiRouter.post("/transcribe", AudioRoute);
// route for userPassword
apiRouter.post("/userPassword", userPassword);

// Use the global /api route
app.use("/api", apiRouter);

// route for saving & getting soapnote details
app.post("/api/soapNote", SOAPNoteRoute);
app.post("/api/soapNote/history", SOAPNoteRoute);
app.post("/api/soapNote/details", SOAPNoteRoute);
app.use("/api", paymentRoute);
app.use("/api/userPassword", userPassword);
app.post("/api/soapNote/delete", SOAPNoteRoute);

app.post('/api/stripe/webhook', stripeRoute);

app.listen(port, () => {
  console.log(`Server running at ${currentServerUrl}`);
});
