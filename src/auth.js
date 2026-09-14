const { OAuth2Client } = require('google-auth-library');
const { saveTokens } = require('./tokens');

const SCOPES = [
  'https://www.googleapis.com/auth/health.activity',
  'https://www.googleapis.com/auth/health.heart_rate',
  'https://www.googleapis.com/auth/health.sleep',
];

function createOAuthClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // siempre pedir consent para garantizar refresh_token
  });
}

async function exchangeCode(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  saveTokens(tokens);
  return tokens;
}

module.exports = { createOAuthClient, getAuthUrl, exchangeCode };
