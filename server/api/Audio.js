const express = require("express");
const path = require("path");
const multer = require("multer");
const accessTokenAutoRefresh = require("../middleware/accessTokenAutoRefresh");
const { SpeechClient } = require("@google-cloud/speech");
const router = express.Router();
const fs = require("fs");
const FormData = require("form-data");
const passport = require("passport");
const OpenAI = require("openai");
const UserDetails = require("../models/userDetails.model");
const User = require("../models/User.model");
const AudioData = require("../models/audioData.model");
// const personalInfo = require("../models/personalInfo.model");
const ffmpeg = require("fluent-ffmpeg");
const { extractJSON } = require("../controllers/soapNoteControllers/soapNoteController");
// ffmpeg.setFfmpegPath("C:\\ffmpeg\\ffmpeg.exe");
// ffmpeg.setFfprobePath("C:\\ffmpeg\\ffprobe.exe");

// ffmpeg path for my machine (maaz)
//ffmpeg.setFfmpegPath("C:\\ffmpeg\\7.0.1\\bin\\ffmpeg.exe");
//ffmpeg.setFfprobePath("C:\\ffmpeg\\7.0.1\\bin\\ffprobe.exe");

function splitAudioFile(audioFilePath) {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(audioDirPath, "chunk-%03d.mp3");
    ffmpeg(audioFilePath)
      .output(outputPattern)
      .outputOptions([
        "-f",
        "segment", // Corrected line: specify format as segment
        "-segment_time",
        "300", // Corrected line: setting each segment's duration to 30 seconds
        "-c",
        "copy", // Corrected line: use stream copy to avoid re-encoding
      ])
      .on("end", function () {
        console.log("File has been split successfully");
        //fs.unlinkSync(audioFilePath); // Optionally remove the original large file
        const chunks = fs
          .readdirSync(audioDirPath)
          .filter((file) => file.startsWith("chunk-"));
        resolve(chunks.map((chunk) => path.join(audioDirPath, chunk)));
      })
      .on("error", function (err) {
        console.log("An error occurred: " + err.message);
        reject(err);
      })
      .run(); // Corrected line: run the configured ffmpeg command
  });
}

async function transcribeAndProcessAudio(audioFilePath) {
  // This function now directly accepts a file path, reads the file, and processes it
  const transcriptionResponse = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
  });
  // console.log("Transcription Response:", transcriptionResponse);
  return transcriptionResponse.text;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const audioDirPath = path.join(__dirname, "../AudioFiles");
// const audioFilePath = path.join(audioFilesPath, 'audio.wav');
//const audioFilePath = path.join(audioFilesPath, 'recordedAudio1.mp3');

router.post("/transcribe", accessTokenAutoRefresh,passport.authenticate('jwt', { session: false }), upload.single("audio"), async (req, res) => {
  console.log("Received audio transcription request");

  let combinedTranscription = "";
  let audioFilePath;

  try {
    //audio buffer which we recive from browser
    const audioData = req.file.buffer;
    console.log("req data", req.body);
    const email = req.body.email;
    const userData = await UserDetails.find({ email });
    console.log("userData", userData);
    const specialty = userData[0]?.specialty || "physician";
    console.log("specialty", specialty);

    // saving audio to local machine
    const timestamp = Date.now();
    const filename = `${timestamp}.mp3`;

    // Construct the full file path
    // testing with static file to get soupnotes
    // const staticFile = "30.mp3";
    audioFilePath = path.join(audioDirPath, filename);
    fs.writeFileSync(audioFilePath, audioData);
    const fileSize = req.file.size;
    console.log("audio file path", audioFilePath);
    // get stats of static file
    // const stats = fs.statSync(audioFilePath);
    // get file size in bytes
    // const fileSize = stats.size;
    console.log("file size", fileSize);
    const maxFileSize = 25 * 1024 * 1024;

    // reading the audio file from localsystem
    // const audioData = fs.readFileSync(audioFilePath);
    if (fileSize <= maxFileSize) {
      // Process normally
      combinedTranscription = await transcribeAndProcessAudio(audioFilePath);
    } else {
      console.log("Large file detected, splitting...");
      const chunkPaths = await splitAudioFile(audioFilePath);
      for (let chunkPath of chunkPaths) {
        const chunkTranscriptionResult = await transcribeAndProcessAudio(chunkPath);
        combinedTranscription += chunkTranscriptionResult + " "; // Accumulate transcription text
        fs.unlinkSync(chunkPath); // Cleanup chunk file after processing
      }
      // console.log("Combined Transcription:", combinedTranscription);
      // Combine transcriptions from all chunks
      //res.json({ status: 200, transcription: combinedTranscription.trim() });
    }

    // console.log("transcriptionResponse", combinedTranscription);
    const noteTitle = "SOAP Note";
    const soapnotecontent = `You are a doctor. Please write a professional ${noteTitle} as a doctor would, ensuring all essential medical terminology is included and include numerical results for any tests performed. Ensure all personal information is anonymized to maintain privacy and response should follow HIPAA complies, response should not contain [name, age, gender, etc.]. Please respond with valid JSON only.  Use the given text "${combinedTranscription}" capturing essential details:
    Subjective: Patient's symptoms, history, and personal reports.
    Objective: Measurable data like vital signs, physical findings, and test results.
    Assessment: Condition analysis based on subjective and objective data.
    Plan: Treatment, prescriptions, tests, advice, referrals, and follow-ups.
    ChiefComplaint : chief complaint of patient from medical conversation in four words only.
    send data in the format SOAP Note: then the subjective and other details. Parse the output data as JSON object so that I can easily use to render it, put the heading as JSON key and then contents as value of that key, don't put subheadings give response as paragraph. Please make sure the output content can be parsed with JSON.parse(), don't write anything extra just give JSON object and wrap the output into ${noteTitle}.`;
    // const soapnotecontent = `generate soap note for the given text "${combinedTranscription}" as a "${specialty}"and send data in the format SOAP Note: then the subjective and other details`;

    const tools = [
      {
        type: "function",
        function: {
          name: "get_soap_note",
          description: "Call this if enough medical information available in provided clinical patient doctor conversation",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              Subjective: { type: "string", description : "Patient's symptoms, history, and personal reports, or related information available in coversation" },
              Objective: { type: "string", description : "Measurable data like vital signs, physical findings, and test results, or related information available in conversation"},
              Assessment: { type: "string", description : "Condition analysis based on subjective and objective data, or related information available in conversation"},
              Plan: { type: "string", description : "Treatment, prescriptions, tests, advice, referrals, and follow-ups, or related information available in conversation"},
              ChiefComplaint : {type : "string", description : "chief complaint of patient from medical conversation in four words only"},
            },
            required: ["Subjective", "Objective","Assessment","Plan","ChiefComplaint"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "error_in_getting_soap_note",
          description: "Call this if insufficient medical information available in clinical patient doctor conversation",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              error: { type: "string" , description : "give message when soap note can't be generated due to insufficient data" },
            },
            required: ["error"],
            additionalProperties: false,
          },
        },
      },
    ];    

    // console.log(soapnotecontent);
    const gptSoapNoteResponse = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide output in valid JSON only" },
        {
          role: "user",
          content: soapnotecontent,
        },
      ],
      response_format : {"type" : "json_object"},
      tool_choice: "required",
      tools,
      model: "gpt-4o",
    });
    console.log("gpt response",gptSoapNoteResponse);
    const soapData = gptSoapNoteResponse.choices[0].message.tool_calls;
    console.log("Soap Data:", soapData);
    // return res.json({status:200,message : "success"});
    const inputString = gptSoapNoteResponse.choices[0].message.tool_calls[0].function.arguments;
    // const cleanedData = inputString
    //   .replace(/\\n/g, "")
    //   .replace(/\\\"/g, '"')
    //   .replace(/\"\n/g, '"');
    // Step 2: Parse the cleaned string
    const jsonObject = extractJSON(inputString);

    // Display the result
    console.log("Json Object",jsonObject);
    if(jsonObject && (jsonObject['SOAP Note']?.error || jsonObject.error) ){
      fs.unlinkSync(audioFilePath);
      return res.json({status:400,soapData : jsonObject,});
    }
    // Extract Chief Complaint
    // const chiefComplaintContent = `Extract the chief complaint from the following medical transcription only four words: "${combinedTranscription}"`;
    // // console.log("\n chiefComplaintContent:", chiefComplaintContent);
    // const gptChiefComplaintResponse = await openai.chat.completions.create({
    //   messages: [
    //     { role: "system", content: "You are a helpful assistant." },
    //     {
    //       role: "user",
    //       content: chiefComplaintContent,
    //     },
    //   ],
    //   model: "gpt-3.5-turbo",
    // });
    // const chiefComplaint = gptChiefComplaintResponse.choices[0].message.content;
    // console.log("Chief Complaint:", chiefComplaint);
    const gptBillingCodesResponse = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Please generate appropriate CPT and ICD-10 codes based on the following medical transcription:"${combinedTranscription}" and the SOAP Note is "${soapData}"  **Instructions:**
          1. Provide the CPT code(s) for any procedures mentioned in the transcription.
          2. Provide the ICD-10 code(s) for any diagnoses or conditions mentioned in the transcription.
          3. Ensure accuracy and relevance to the context of the transcription.
          4. Make sure the response is tabulated -> description|CPT|ICD-10 .
          5. start with "| Description" and do not give any details or explanation before that`,
        },
      ],
      model: "gpt-3.5-turbo",
    });
    const billingCodes = gptBillingCodesResponse.choices[0].message.content;
    // console.log("Billing Codes:", billingCodes);

    res.json({
      status: 200,
      soapData : jsonObject,
      billingCodes,
      combinedTranscription,
      chiefComplaint : jsonObject.ChiefComplaint,
    });
    console.log("I have reached here");
    fs.unlinkSync(audioFilePath);
  } catch (error) {
    console.error("Error processing audio:", error);
    fs.unlinkSync(audioFilePath);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
