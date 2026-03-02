const axios = require('axios');
const https = require('https');
const { generateLoginToken } = require('./jwt');
const db = require('../db');

// Reusable HTTPS agent that accepts self-signed certificates
// The RC5000 uses a self-signed cert — rejectUnauthorized must be false
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// In-memory session store (one active session at a time)
let activeSession = {
  token: null,
  expiresAt: null,
  ip: null,
  port: null,
  useHttps: null
};

function getBaseUrl(settings) {
  const { ip, port, useHttps } = settings.sesami;
  const protocol = useHttps ? 'https' : 'http';
  return `${protocol}://${ip}:${port}/api/pos/v3`;
}

function getClient(baseURL, bearerToken = null) {
  const headers = {};
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  return axios.create({
    baseURL,
    timeout: 8000,
    headers,
    httpsAgent,          // always included — harmless for HTTP, required for HTTPS
    validateStatus: null // let us handle all status codes manually
  });
}

async function login() {
  const settings = db.getSettings();
  const { ip, port, useHttps, posId, username, secretKey } = settings.sesami;
  const baseURL = getBaseUrl(settings);

  const loginToken = generateLoginToken({ username, posId, secretKey });

  const client = getClient(baseURL);
  const response = await client.post('/login', { token: loginToken });

  if (response.status !== 200) {
    throw new Error(`Login failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }

  activeSession = {
    token: response.data.token,
    expiresAt: response.data.expiration,
    ip, port, useHttps
  };

  return response.data;
}

async function logout() {
  if (!activeSession.token) return;
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  const client = getClient(baseURL, activeSession.token);
  try {
    await client.post('/logout');
  } finally {
    activeSession = { token: null, expiresAt: null, ip: null, port: null, useHttps: null };
  }
}

// Uses /heartbeat (unauthenticated) to check device reachability
async function getHeartbeat() {
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  console.log('[RC5000] heartbeat →', baseURL + '/heartbeat');
  const client = getClient(baseURL);
  const response = await client.get('/heartbeat');
  console.log('[RC5000] heartbeat response status:', response.status);
  if (response.status !== 200) {
    throw new Error(`Heartbeat failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function getStatus() {
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  console.log('[RC5000] status →', baseURL + '/status');
  const client = getClient(baseURL);
  const response = await client.get('/status');
  if (response.status !== 200) {
    throw new Error(`Status check failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function startPayinAmount(amountCents) {
  if (!activeSession.token) await login();
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  const client = getClient(baseURL, activeSession.token);

  const response = await client.post('/operations/start', {
    type: 10,
    amount: Math.round(amountCents)
  });
  if (response.status !== 200) {
    throw new Error(`Start operation failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function getOperationStatus(operationId) {
  if (!activeSession.token) throw new Error('No active session');
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  const client = getClient(baseURL, activeSession.token);
  const response = await client.get(`/operations/status/${operationId}`);
  return response.data;
}

async function finishOperation() {
  if (!activeSession.token) throw new Error('No active session');
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  const client = getClient(baseURL, activeSession.token);
  const response = await client.post('/operations/finish');
  return response.data;
}

async function cancelOperation() {
  if (!activeSession.token) throw new Error('No active session');
  const settings = db.getSettings();
  const baseURL = getBaseUrl(settings);
  const client = getClient(baseURL, activeSession.token);
  const response = await client.post('/operations/cancel');
  return response.data;
}

module.exports = {
  login,
  logout,
  getStatus,
  getHeartbeat,
  startPayinAmount,
  getOperationStatus,
  finishOperation,
  cancelOperation,
  get activeSession() { return activeSession; }
};
