const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '..', 'tokens.json');

function loadTokens() {
  // 1. Intenta desde archivo (redeploy reciente con auth)
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  }
  // 2. Fallback: variable de entorno (sobrevive redeploys)
  if (process.env.TOKEN_JSON) {
    return JSON.parse(Buffer.from(process.env.TOKEN_JSON, 'base64').toString('utf8'));
  }
  return null;
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function getTokensAsBase64() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return Buffer.from(fs.readFileSync(TOKEN_FILE, 'utf8')).toString('base64');
}

module.exports = { loadTokens, saveTokens, getTokensAsBase64 };
