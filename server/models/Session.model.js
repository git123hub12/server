const mongoose = require('mongoose');
const { Schema } = mongoose;

const SessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'QurenoteUser', required: true },
  deviceInfo: { type: String, required: true },
  ip: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  session: { type: String, required: true },
  active: { type: Boolean, default: true },
  expiry: { type: Date, expires: 0 } 
}, {
  timestamps: true // Automatically create createdAt and updatedAt fields
});

SessionSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);


module.exports = Session;
