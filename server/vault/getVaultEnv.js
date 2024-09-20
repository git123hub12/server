require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vault = require('node-vault')({
  endpoint: process.env.VAULT_ENDPOINT, // Load from .env file
});

// Essential for logging the token
const roleId = process.env.ROLE_ID; // Load from .env file
const secretId = process.env.SECRET_ID; // Load from .env file
// Key vault for encryption
const encryptionKey = crypto.createHash('sha256')
                            .update(process.env.SUPER_SECRET_KEY) // Load from .env file
                            .digest('base64')
                            .substr(0, 32); // Ensure the key is 32 bytes
const algorithm = 'aes-256-cbc';

/**
 * Encrypts a text using AES-256-CBC encryption.
 * @param {string} text - The text to encrypt.
 * @returns {string} Encrypted text in the format: IV:encryptedText
 */
//encrypted Data while fetching 
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionKey, 'base64'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Retrieves credentials from Vault using AppRole authentication.
 * @param {string} vaultPath - The path to the credentials in Vault.
 * @returns {Object|null} Retrieved credentials or null if error occurs.
 */
// Authentication of vault and reading the values from the vault 
async function getCredentials(vaultPath) {
  try {
    const loginResponse = await vault.approleLogin({
      role_id: roleId,
      secret_id: secretId,
    });

    const token = loginResponse.auth.client_token;
    vault.token = token;

    const result = await vault.read(vaultPath);
    return result.data.data;
  } catch (error) {
    console.error(`Error retrieving credentials from Vault at path ${vaultPath}:`, error);
    return null;
  }
}

/**
 * Updates the .env file with new or updated environment variables.
 * @param {string} envFilePath - Path to the .env file.
 * @param {Object} newVars - New or updated environment variables to write.
 */
// updating the fetched values to the file path
function updateEnvFile(envFilePath, newVars) {
  let envFileContent = '';
  if (fs.existsSync(envFilePath)) {
    envFileContent = fs.readFileSync(envFilePath, 'utf8');
  }

  const envLines = envFileContent.split('\n');
  const envVarMap = {};

  envLines.forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVarMap[key] = value;
    }
  });

  Object.entries(newVars).forEach(([key, value]) => {
    envVarMap[key] = encrypt(value);
  });

  const updatedEnvLines = envLines.map(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      return `${key}=${envVarMap[key]}`;
    }
    return line;
  });

  const newVarsKeys = Object.keys(newVars);
  const newVarsLines = newVarsKeys.filter(key => !envLines.some(line => line.startsWith(key + '=')))
                                  .map(key => `${key}=${envVarMap[key]}`);

  const finalEnvContent = [...updatedEnvLines, ...newVarsLines].join('\n');
  fs.writeFileSync(envFilePath, finalEnvContent);
}

/**
 * Main function to fetch credentials from Vault and update .env file.
 */
async function main() {
  const envFilePath = process.env.ENV_FILE_PATH; // Load from .env file

  const authenticationCredentials = await getCredentials('kv/data/AUTHENTICATION');
  const googleCredentials = await getCredentials('kv/data/Google');
  const facebookCredentials = await getCredentials('kv/data/Facebook');
  const awsCredentials = await getCredentials('kv/data/Aws');
  const otherCredentials = await getCredentials('kv/data/Others');
  const miscCredentials = await getCredentials('kv/data/misc');

  const credentials = {
    ...authenticationCredentials,
    ...googleCredentials,
    ...facebookCredentials,
    ...awsCredentials,
    ...otherCredentials,
    ...miscCredentials,
  };

  console.log('Fetched and encrypted credentials.');
  console.log('Updating .env file at:', envFilePath);
  
  updateEnvFile(envFilePath, credentials);
  
  console.log('Credentials updated in .env file');
}

if (require.main === module) {
  main();
}
