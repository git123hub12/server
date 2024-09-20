const express = require("express");
const router = express.Router();
const SoapNote = require("../models/soapNote.model");
const User = require("../models/User.model");
const UserDetails = require("../models/userDetails.model");
const AudioData = require("../models/audioData.model");
const { isValidObjectId } = require("mongoose");
const multer = require("multer");
const AWS = require("aws-sdk");
const soapNote = require("../models/soapNote.model");
const { updateSoapNote, createSoapNote } = require("../controllers/soapNoteControllers/soapNoteController");
const passport = require("passport");
const accessTokenAutoRefresh = require("../middleware/accessTokenAutoRefresh");
const s3 = new AWS.S3();
const BUCKET_NAME = "qurenoteaudio";
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Uploads audio data to AWS S3 and returns the URL of the uploaded file.
 * 
 * @param {Buffer} audioData - The audio data to upload.
 * @param {string} [contentType="mp3"] - The MIME type of the audio file, default is mp3.
 * @param {string} soapNoteId - The unique identifier for the SOAP note associated with this audio.
 * @returns {Promise<string>} The URL of the uploaded audio file.
 * @throws {Error} Throws an error if the upload fails.
 */
async function saveawss3Audio(audioData, contentType = "mp3", soapNoteId) {
    if (!audioData || !soapNoteId) {
        console.error("Missing required parameter(s): 'audioData' and 'soapNoteId' must be provided.");
        throw new Error("Missing required parameters.");
    }

    try {
        // Define the S3 upload parameters
        const uploadParams = {
            Bucket:  BUCKET_NAME, // The name of your S3 bucket
            Key: `${soapNoteId}.${contentType}`, // Object key in S3 bucket
            Body: audioData, // Actual audio data
            ContentType: `audio/${contentType}`, // MIME type of the file
            ACL: "public-read" // Set the file to be publicly readable
        };

        // Execute the upload to S3
        const s3UploadResponse = await s3.upload(uploadParams).promise();
        const audioLink = s3UploadResponse.Location; // URL of the uploaded file
        console.log("Audio uploaded to S3 successfully:", audioLink);
        return audioLink;
    } catch (error) {
        console.error("Error uploading audio data to S3:", error);
        throw new Error("Failed to upload audio to S3.");
    }
}

// Middleware to handle file uploads, assume 'upload' is defined appropriately
router.post("/api/soapNote", accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), upload.single("audio"), async (req, res) => {
    console.log("Received SOAP note with file.");
  const { soapNoteId } = JSON.parse(req.body.newSoapNote);
  // if soapnote id is availabe then don't check for file because in that case this call for soapnote updation
    if (!soapNoteId && !req.file) {
        console.error("No audio file provided.");
        return res.status(400).json({ status: "Error", message: "No audio file uploaded" });
    }

    try {
        const {
            email,
        //   soapNoteId,
            subjective,
            objective,
            assessment,
            plan,
            chiefComplaint,
            completed,
            transcriptedText,
            consolidatedText,
            billingCodesText,
        } = JSON.parse(req.body.newSoapNote);

        // Check if soapNoteId is provided and is valid
        if (soapNoteId && !isValidObjectId(soapNoteId)) {
            console.error("Invalid SOAP note ID:", soapNoteId);
            return res.status(400).json({ status: "Error", message: "Invalid SOAP note ID" });
        }

        

        // Find the user by email to get their ID
        const user = await checkEmailExistence(email);
        if (!user) {
            return res.status(404).json({ status: "Error", message: "User not found" });
        }

        let soapNote;
        if (soapNoteId) {
            // Attempt to find and update existing SOAP note
            const soapNoteData = { subjective, objective, assessment, plan, chiefComplaint, billingCodesText };
            const updatedSoapNote = await updateSoapNote(soapNoteId, soapNoteData);
            if (!updatedSoapNote) {
                return res.status(404).json({ status: "Error", message: "SOAP note not found" });
            }
            res.json({ status: "Success", message: "SOAP note updated successfully!", soapNoteId: updatedSoapNote._id });
        } else {
            // Create a new SOAP note since no ID was provided or found
            const audioData = req.file.buffer;
            const contentType = req.file.mimetype.split("/")[1] || "mp3";
            const soapNoteData = {
                userId: user.userId,
                subjective,
                objective,
                assessment,
                plan,
                chiefComplaint,
                consolidatedText,
                transcriptedText,
                completed,
                createdAt: new Date(),
                billingCodesText,
            };
            const soapNote = await createSoapNote(soapNoteData);
            if (!soapNote) {
                return res.status(400).json({ status: "Error", message: "Error in saving SOAP note, check data provided" });
            }
            const awss3url = await saveawss3Audio(audioData, contentType, soapNote._id);
            console.log("Audio uploaded to S3 at URL:", awss3url);
            await updateSoapNote(soapNote._id, { awss3url });
            console.log("Created SoapNote ID", soapNote._id);
            // await saveAudioData(email, audioData, contentType, soapNote._id, awss3url);

            res.json({ status: "Success", message: "New SOAP note saved successfully!", soapNoteId: soapNote._id });
        }
    } catch (error) {
        console.error("Error processing SOAP note request:", error);
        res.status(500).json({ status: "Error", message: "Internal Server Error" });
    }
});

router.post("/api/soapNote/history", accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), async (req, res) => {
    console.log("Request user details:", req.user);
    const { data } = req.body;

    if (!data) {
        console.error("No data provided in the request.");
        return res.status(400).json({ status: "Error", message: "Data is required" });
    }

    try {
        // Check the existence of the user by the provided data (typically email)
        const existingUser = await checkEmailExistence(data);
        if (!existingUser) {
            console.error("User not found with provided data:", data);
            return res.status(404).json({ status: "Error", message: "User not found" });
        }

        console.log("Existing user found:", existingUser.userId);

        if (!isValidObjectId(existingUser.userId)) {
            console.error("Invalid user ID:", existingUser.userId);
            return res.status(400).json({ status: "Error", message: "Invalid user ID" });
        }

        // Retrieve all SOAP notes associated with the user, sorted by creation date
        const soapNotes = await SoapNote.find({ userId: existingUser.userId }).sort({ createdAt: -1 });
        if (soapNotes.length === 0) {
            console.log("No SOAP notes found for the user:", existingUser.userId);
            return res.status(404).json({ status: "Success", message: "No SOAP notes found", soapNotes: [] });
        }

        console.log("SOAP notes retrieved for user:", soapNotes.length);
        res.json({ status: "Success", soapNotes });
    } catch (error) {
        console.error("Error fetching SOAP notes:", error);
        res.status(500).json({ status: "Error", message: "Internal Server Error" });
    }
});

router.post("/api/soapNote/details", accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), async (req, res) => {
    console.log("Processing request for SOAP note details", req.body);

    const { id } = req.body;

    if (!id) {
        console.error("No ID provided in request");
        return res.status(400).json({ status: "Error", message: "SOAP note ID is required" });
    }

    if (!isValidObjectId(id)) {
        console.error("Invalid SOAP note ID:", id);
        return res.status(400).json({ status: "Error", message: "Invalid SOAP note ID" });
    }

    try {
        // Find an existing SOAP note by ID
        const existingSoapNote = await SoapNote.findById(id);
        if (!existingSoapNote) {
            console.log("SOAP note not found:", id);
            return res.status(404).json({ status: "Error", message: "SOAP note not found" });
        }

        // Query the database to find associated audio details
        // const audioDetails = await AudioData.findOne({ "audios.soapNoteId": id });
        // if (!audioDetails || !audioDetails.audios) {
        //     console.log(`No audio details found for soapNoteId: ${id}`);
        //     return res.status(404).json({ status: "Error", message: "Audio details not found" });
        // }

        // const audio = audioDetails.audios.find(audio => audio.soapNoteId === id);
        // if (!audio) {
        //     console.log("Audio details associated with the SOAP note not found:", id);
        //     return res.status(404).json({
        //         status: "Error",
        //         message: "Associated audio details not found"
        //     });
        // }

        // Respond with the SOAP note and audio details
        res.status(200).json({
            status: "Success",
            message: "SOAP note and audio details retrieved successfully",
            soapNote: existingSoapNote,
            // audioDetails: audio.audioData,
        });
    } catch (error) {
        console.error("Error fetching SOAP note details:", error);
        res.status(500).json({ status: "Error", message: "Internal Server Error" });
    }
});

// Verify user email existence
async function checkEmailExistence(email) {
    try {
    const user = await User.findOne({ email });
    if (user) {
      return { userId: user._id, model: "QurenoteUser" };
    }

    const userDetails = await UserDetails.findOne({ email });
    if (userDetails) {
      return { userId: userDetails._id, model: "QurenoteUserDetails" };
    }

    return null; // Email not found in both tables
  } catch (error) {
    console.error("Error checking email existence:", error);
    throw error;
  }
}


// Route to save audio data with user ID and other required details
/**
 * Saves audio data associated with a user identified by email.
 * @param {string} email - User's email address.
 * @param {Buffer} audioData - Audio data in binary format.
 * @param {string} contentType - MIME type of the audio data.
 * @param {string} soapNoteId - Associated SOAP note ID.
 * @param {string} awss3url - URL of the audio data stored in AWS S3.
 */
async function saveAudioData(email, audioData, contentType, soapNoteId, awss3url) {
    if (!email || !audioData || !contentType || !soapNoteId || !awss3url) {
        console.error("Missing required parameter(s). All parameters must be provided.");
        throw new Error("Missing required parameter(s).");
    }

    try {
        // Check if the email exists in the system
        const user = await checkEmailExistence(email);
        if (!user) {
            console.log("No user found with the email:", email);
            return false;  // Indicate failure to find the user
        }

        // Convert audio data to a base64 string for storage
        const audioBase64 = audioData.toString("base64");

        // Attempt to retrieve existing audio data for the user
        const existingUserAudioData = await AudioData.findOne({ userId: user.userId });
        if (existingUserAudioData) {
            // User already has audio data, append new data to the existing array
            existingUserAudioData.audios.push({
                // audioData: audioBase64,
                contentType,
                uploadTimestamp: new Date(),
                soapNoteId,
                awss3url,
            });
            await existingUserAudioData.save();
            console.log("Added new audio data to the existing user record.");
        } else {
            // No existing audio data, create a new record
            await AudioData.create({
                userId: user.userId,
                userModel: user.model,
                audios: [{
                    // audioData: audioBase64,
                    contentType,
                    uploadTimestamp: new Date(),
                    soapNoteId,
                    awss3url,
                }],
            });
            console.log("Created new audio data record for the user.");
        }
        return true;  // Indicate success
    } catch (error) {
        console.error("Failed to save audio data:", error);
        throw new Error("An error occurred while saving audio data.");
    }
}


// Route to delete a SOAP note and associated audio details
router.post("/api/soapNote/delete", accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), async (req, res) => {
  const soapNoteId = req.body.id;

  // Log incoming request details
  console.log("Request to delete SOAP note with ID:", soapNoteId);

  if (!soapNoteId) {
      console.error("No SOAP note ID provided in the request body");
      return res.status(400).send("Missing SOAP note ID.");
  }

  try {
      // Attempt to find the SOAP note by ID
      const soapNote = await SoapNote.findById(soapNoteId);
      if (!soapNote) {
          console.log("No SOAP note found with ID:", soapNoteId);
          return res.status(404).send("SOAP note not found.");
      }

      // Attempt to find associated audio data
      const audioData = await AudioData.findOne({ "audios.soapNoteId": soapNoteId });
      if (audioData) {
          // Iterate over audios array to find and delete each associated audio file from S3
          const promises = audioData.audios.filter(audio => audio.soapNoteId === soapNoteId).map(async (audio) => {
              if (audio.awss3url) {
                  const s3Url = new URL(audio.awss3url);
                  const params = {
                    Bucket: BUCKET_NAME, // Extract bucket name
                    Key: s3Url.pathname.substring(1) // This removes the leading slash from the pathname
                  };
                  await s3.deleteObject(params).promise();
                  console.log('File deleted from S3:', audio.awss3url);
              }
          });

          // Wait for all S3 deletions to complete
          await Promise.all(promises);

          // Remove the audio entries from the AudioData document
          await AudioData.updateOne(
              { _id: audioData._id },
              { $pull: { audios: { soapNoteId: soapNoteId } } }
          );
          console.log('Audio details associated with the SOAP note deleted successfully.');
      }

      // Finally, delete the SOAP note
      await SoapNote.deleteOne({ _id: soapNoteId });
      console.log("SOAP note deleted successfully.");

      res.status(200).send("Both SOAP note and associated audio details deleted successfully.");
  } catch (error) {
      console.error('Error while deleting SOAP note or associated audio:', error);
      res.status(500).send('Error deleting data: ' + error.message);
}
});

module.exports = router;
