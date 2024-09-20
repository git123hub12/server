const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserDetailsSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  state: { type: String, required: true },
  specialty: { type: String, required: true },
  address: { type: String, required: true },
}, {
  timestamps: true // Automatically create createdAt and updatedAt fields
});
const QurenoteUserDetails = mongoose.models.QurenoteUserDetails || mongoose.model('QurenoteUserDetails', UserDetailsSchema);

module.exports = QurenoteUserDetails;