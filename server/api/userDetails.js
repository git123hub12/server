const express = require('express');
const router = express.Router();
const passport = require("passport");
const User = require('../models/User.model');
const UserDetails = require('../models/userDetails.model');
const userFromToken = require('../middleware/jwtMiddleware');
const accessTokenAutoRefresh = require('../middleware/accessTokenAutoRefresh');



router.get('/:userId',accessTokenAutoRefresh,passport.authenticate('jwt',{session:false}), async (req, res) => {
  const { userId } = req.params;
  if(req.user._id.toString() !== userId){
    return res.status(401).json({error : "not authorized"});
  }
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userDetails = null;
    if (user.userDetails) {
      userDetails = await UserDetails.findById(user.userDetails);
    }

    const responseData = {
      user,
      userDetails
    };

    return res.json({ status: 'SUCCESS', data: responseData });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// Endpoint to add or update user details
router.post('/:userId',accessTokenAutoRefresh, passport.authenticate('jwt',{session:false}), async (req, res) => {
  const { userId } = req.params;
  console.log('userId:', userId);
  const userDetailsData = req.body;
  
  console.log('userDetailsData:', userDetailsData);

  try {
    // Create or update UserDetails
    let userDetails = await UserDetails.findOneAndUpdate(
      { email: userDetailsData.email },
      userDetailsData,
      { new: true, upsert: true } // Create if not exists, return the updated document
    );

    // Update the user's userDetail field
    await User.findByIdAndUpdate(userId, { userDetails: userDetails._id });

    res.status(200).json({ message: 'UserDetails updated successfully', userDetails });
  } catch (err) {
    console.error('Error updating UserDetails:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
