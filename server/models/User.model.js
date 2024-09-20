const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  fullname: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: {
    type: String,
    required: function () {
      return !this.google?.id && !this.facebook?.id && !this.corp?.id; // Password is required if not using Google, Facebook, or corporate auth
    }
  },
  dateOfBirth: { type: String, required: false },
  verified: { type: Boolean, default: false },
  isSubscribed: { type: Boolean, default: false },
  google: {
    id: { type: String, unique: true, sparse: true },
    email: String,
    accessToken: String,
  },
  facebook: {
    id: { type: String, unique: true, sparse: true },
    email: String,
    accessToken: String,
  },
  corp: {
    id: { type: String, unique: true, sparse: true },
    email: String,
    domain: String,
    accessToken: String,
  },
  userDetails: { type: Schema.Types.ObjectId, ref: 'UserDetails' }
}, {
  timestamps: true // Automatically create createdAt and updatedAt fields
});

const QurenoteUser = mongoose.models.QurenoteUser || mongoose.model('QurenoteUser', UserSchema);

module.exports = QurenoteUser;




// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// const UserSchema = new Schema({
//   name: String,
//   firstName: String,
//   lastName: String,
//   email: String,
//   // phoneNumber: String,
//   password: String,
//   dateOfBirth: String,
//   verified: Boolean,
//   isSubscribed: {
//     type: Boolean,
//     default: false,
//   },
//   local: {
//     username: String,
//     password: String,
//   },
//   google: {
//     id: String,
//     email: String,
//     accessToken: String,
//   },
//   facebook: {
//     id: String,
//     email: String,
//     accessToken: String,
//   },
// });

// const User = mongoose.model("QurenoteUser", UserSchema);

// module.exports = User;
