const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const soapNoteSchema = new Schema({
  userId: String,
  subjective: String,
  objective: String,
  assessment: String,
  plan: String,
  chiefComplaint: String,
  transcriptedText: String,
  consolidatedText: Object,
  completed: Boolean,
  billingCodesText: String,
  awss3url: {
    type: String,
    required : false,
  },
  createdAt: { type: Date, required: true, default: Date.now },
});
soapNoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });


const soapNote = mongoose.model("QurenoteSoapNote", soapNoteSchema);

module.exports = soapNote;
