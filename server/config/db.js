const mongoose = require('mongoose');
require('dotenv').config();

const dbURI = process.env.BACKEND_SERVER === 'true' 
  ? process.env.MONGODB_URI 
  : process.env.DEV_MONGODB_URI;

console.log('This is running on',dbURI);
// console.log("dbURI",dbURI)

// mongodb connection code
mongoose.connect(dbURI
, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("DB Connected");
}).catch((err) => {
    console.log(err);
})
