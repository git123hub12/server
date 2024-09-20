const mongoose = require("mongoose");

// Define the schema
const audioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "userModel",
  },
  userModel: {
    type: String,
    required: true,
    enum: ["QurenoteUser", "QurenoteUserDetails"], // Replace with your actual user model names
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  audios: [
    {
      audioData: {
        type: String,
        required: false,
      },
      contentType: {
        type: String,
        required: true,
      },
      uploadTimestamp: {
        type: Date,
        default: Date.now,
        required: true,
      },
      soapNoteId: {
        type: String,
        required: true,
      },
      awss3url: {
        type: String,
      },
      // You can add more metadata fields for each audio if needed
    },
  ],
});

// Create a model using the schema
const Audio = mongoose.model("AudioData", audioSchema);

module.exports = Audio;
