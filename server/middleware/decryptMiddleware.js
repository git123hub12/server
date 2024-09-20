// decryptMiddleware.js
const CryptoJS = require('crypto-js');

const decryptMiddleware = (req, res, next) => {
    try {
        const key = 'your-secret-key'; // Replace with your secret key

        console.log("inside decryptMiddleware");
        console.log()
        console.log("req.path:", req.path);
        console.log()


        // Check if the route is the verification route
        if (req.path.startsWith('/verify/') || req.path.startsWith('/verified/')) {
            // If it is the verification route, skip decryption
            console.log("inside if in decryptMiddleware for user/ verify and verified path");

            return next();
        }else {
            console.log()

            console.log("inside else in decryptMiddleware");
            console.log()

            if (!req.body.encrypted) {
                throw new Error('Encrypted data not found in the request body');
            }
    
            const encryptedData = req.body.encrypted;
    
            console.log("encryptedData in decryptMiddleware =>", encryptedData)
    
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, key);
            const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
            const decryptedUserData = JSON.parse(decryptedString);
    
            console.log("decryptedUserData in decryptMiddleware =>", decryptedUserData)
    
            // Add the decrypted data to the request object
            req.decryptedUserData = decryptedUserData;
    
            next();
        }
    } catch (error) {
        console.error('Error in decryptMiddleware:', error);
        res.status(400).json({ status: 'FAILED', message: 'Error decrypting data' });
    }
};

module.exports = decryptMiddleware;
