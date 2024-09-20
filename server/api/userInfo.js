const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const personalInfo = require("../models/personalInfo.model");

router.post("/userInfo", async (req, res) => {
  try {
    console.log("inside api calll");
    let { email } = req.body;
    console.log("email in userinfo", email);
    const todos = await personalInfo.find({ email });
    console.log("TODOS", todos);
    res.send(todos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
