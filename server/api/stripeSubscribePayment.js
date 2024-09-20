const express = require("express");
const router = express.Router();
const User= require('../models/User.model')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  console.log("entered into stripe backend");

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log("entered try block");
  } catch (err) {
    console.log(`❌ Error message: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    console.log("entered into event type");
    const session = event.data.object;


    // Fulfill the purchase...
    handleCheckoutSession(session);
  }

  // Return a response to acknowledge receipt of the event
  res.json({received: true});
};

function handleCheckoutSession(session) {
  // your business logic here
  // /set user isSubscribed to true
   const userId = session.client_reference_id;
   console.log("userId in handleCheckoutSession",userId);
  User.updateOne({ _id: userId }, { isSubscribed: true });
  console.log(`🔔  Payment received!`);
  res.json({ received: true });
  res.status(200).json({ message: 'Payment received!' }, User.isSubscribed);

}