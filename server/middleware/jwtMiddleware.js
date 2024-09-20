const jwt = require("jsonwebtoken");
require("dotenv").config();

const userFromToken = async (req,res,next) =>{
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({error : 'Unauthorized - Token not provided'});
        }
        const token = authHeader.split(' ')[1];

        jwt.verify(token,process.env.CREATE_TOKEN_SECRET,(err,decoded)=>{
            if(err){
                return res.status(401).json({error : "Unauthorized - Invalid token"});
            }
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(500).json({error : "Internal server error Please try again !!!"});
    }
}

module.exports = userFromToken;