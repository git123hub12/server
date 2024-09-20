const express = require("express");
require("dotenv").config();
const User = require("../models/User.model");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const mongoose = require("mongoose");


// This is your Stripe CLI webhook secret for testing your endpoint locally.
// const endpointSecret = "whsec_f733e21c7e8d3a1b61f2112f7137b582493536f70c5d5277935faa238dce0593";
const stripe_key = process.env.STRIPE_WEBHOOK_SECRET;
// after stripe payment page stripe will call this api where we can handle the events of stripe
router.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  // console.log("entered into backend call");
  const sig = request.headers['stripe-signature'];
  console.log("stripe signature",sig);
  console.log("request body",request.body);
  let event;

  try {
    event = await stripe.webhooks.constructEvent(request.body, sig, stripe_key);
    console.log("webhook verified");
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      // console.log("payment succeeded",paymentIntentSucceeded);
      // Then define and call a function to handle the event payment_intent.succeeded
      break;
    // ... handle other event types
    // after the checkout session complete updating the user database with is subscribed true
    case 'checkout.session.completed' :
      const paymentObject = event.data.object;
      console.log("checkout completed",paymentObject);
      const userId = paymentObject.client_reference_id;
      const id = mongoose.Types.ObjectId.createFromHexString(userId);
      const user = await User.findOne({_id : id});
      console.log("subscribed user before update",user);
      await User.updateOne({ _id: id }, { isSubscribed: true });
      const updatedUser = await User.findOne({_id : id});
      console.log("subscibed user after update",updatedUser);
      response.send({success : true,message : "user subscribed"});
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send().end();
});


module.exports = router;
