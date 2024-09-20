const soapnoteModel = require("../../models/soapNote.model");
// update the soapnote. First get the soapnote with id and then update it soapnote data
/**
 * @description : it will take a soapnote id and updated data and then update the coresponding soapnote with new updated data.
 * @param {soapnote id} soapNoteId 
 * @param {updated data} soapNoteData 
 * @returns updated soapnote || null
 */
const updateSoapNote = async (soapNoteId, soapNoteData) => {
  const soapNoteRecord = await soapnoteModel.findById(soapNoteId);
  if (!soapNoteRecord) return null;
  else {
    Object.assign(soapNoteRecord, {
      ...soapNoteData
    });
    const updatedSoapNote = await soapNoteRecord.save();
    return updatedSoapNote;
  }
};
// create a new soapnote
/**
 * 
 * @param {fields required for creating a new soapnote} soapNoteData 
 * @returns soapnote || null
 */
const createSoapNote = async (soapNoteData)=>{
    const soapNoteRecord = new soapnoteModel({
        ...soapNoteData
    });
    try{
        const createdSoapNote = await soapNoteRecord.save();
        return createdSoapNote;
    }catch(error){
        console.log("error in creating soapNote",error);
        return null;
    }
}
/**
 * @description this function will take text as input and if valid JSON is present in the text then it will parse it to JSON object and return it
 * @param {take text as input to parse it as json object} response 
 * @returns JSON object | print error if not possible
 */
const extractJSON = (response) => {
  try {
    // Try to parse the response as JSON
    return JSON.parse(response);
  } catch (e) {
    // If parsing fails, look for JSON part in the response
    const jsonMatch = response.match(/{.*}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      console.log('No valid JSON found in response',e);
    }
  }
}

module.exports = {updateSoapNote,createSoapNote,extractJSON}