const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Decryption of Data Recevied from the vault.
const encryptionKey = crypto.createHash('sha256').update(String('my_super_secret_key_123!')).digest('base64').substr(0, 32); // Ensure the key is 32 bytes
const algorithm = 'aes-256-cbc';
// to decypt the Data from from .env file
function decrypt(text) {
  if (!text) {
    throw new Error('No text provided for decryption');
  }

  const [ivHex, encryptedText] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedText, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
// Replace the values from the .env that are decypted
function updateEnvFile(envFilePath) {
  const envFileContent = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8') : '';
  const envLines = envFileContent.split('\n');

  const decryptedVars = {};
  const updatedEnvLines = envLines.map(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const encryptedValue = match[2].trim();
      console.log(`Decrypting key: ${key}`);
      const decryptedValue = decrypt(encryptedValue);
      decryptedVars[key] = decryptedValue;
      return `${key}=${decryptedValue}`;
    }
    return line;
  });

  const finalEnvContent = updatedEnvLines.join('\n');
  fs.writeFileSync(envFilePath, finalEnvContent);
}
// main funtion to call all the above functions
async function main() {
  const envFilePath = path.resolve('/Users/winnie/Downloads/repo-dev/server/', '.env');
  console.log('Reading and decrypting .env file at:', envFilePath);
  updateEnvFile(envFilePath);
  console.log('Credentials decrypted and updated in .env file');
}

if (require.main === module) {
  main();
}


