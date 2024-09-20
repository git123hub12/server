const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: String,
    name: String,
    uniqueString: String,
    createdAt: Date,
    expiresAt: Date
});

const UserVerification = mongoose.model('QurenoteUserVerification',UserVerificationSchema);

module.exports = UserVerification;