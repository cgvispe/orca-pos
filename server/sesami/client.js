const axios = require('axios');
const https = require('https');
const { generateLoginToken } = require('./jwt');
const { OperationType } = require('./operationTypes');
const db = require('../db');

// Self-signed cert support — RC5000 uses self-signed HTTPS
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// In-memory session cache: deviceId → { token, expiresAt }
// Also persisted to DB so bearer tokens survive server restarts
const sessions = new Map();

function getBaseUrl(device) {
  const protocol = device.useHttps ? 'https' : 'http';
  return `${protocol}://${device.ip}:${device.port}/api/pos/v3`;
}

function getClient(baseURL, bearerToken = null) {
  const headers = {};
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  return axios.create({ baseURL, timeout: 8000, headers, httpsAgent, validateStatus: null });
}

function getDeviceOrThrow(deviceId) {
  const device = db.getDeviceById(deviceId);
  if (!device) throw new Error(`Device not found: ${deviceId}`);
  if (!device.ip) throw new Error(`Device ${device.name} has no IP configured`);
  return device;
}

// Returns the best available token: in-memory first, then persisted DB token
function getToken(deviceId) {
  return sessions.get(deviceId)?.token || db.getDeviceSession(deviceId);
}

async function login(deviceId, retryAfterRecovery = false) {
  const device = getDeviceOrThrow(deviceId);
  const baseURL = getBaseUrl(device);
  const loginToken = generateLoginToken({
    username: device.username,
    posId: device.posId,
    secretKey: device.secretKey
  });

  console.log(`[RC5000:${device.name}] login → ${baseURL}/login`);
  const client = getClient(baseURL);
  const response = await client.post('/login', { token: loginToken });

  if (response.status === 400) {
    const msg = response.data?.error?.message || '';
    if (!retryAfterRecovery && (msg.includes('ya iniciada') || msg.includes('already') || msg.includes('active'))) {
      console.warn(`[RC5000:${device.name}] stale session detected — attempting recovery`);

      // Try with persisted bearer token first (survives server restarts)
      const persistedToken = db.getDeviceSession(deviceId);
      if (persistedToken) {
        const authedClient = getClient(baseURL, persistedToken);
        // Must cancel/finish active operation BEFORE logout
        console.log(`[RC5000:${device.name}] cancelling active operation with persisted token`);
        try {
          const cancelRes = await authedClient.post('/operations/cancel');
          console.log(`[RC5000:${device.name}] cancel response:`, cancelRes.status, JSON.stringify(cancelRes.data));
        } catch (e) {
          console.warn(`[RC5000:${device.name}] cancel failed:`, e.message);
        }
        try {
          const finishRes = await authedClient.post('/operations/finish');
          console.log(`[RC5000:${device.name}] finish response:`, finishRes.status, JSON.stringify(finishRes.data));
        } catch (e) {
          console.warn(`[RC5000:${device.name}] finish failed:`, e.message);
        }
        console.log(`[RC5000:${device.name}] logging out with persisted token`);
        try {
          await authedClient.post('/logout');
          console.log(`[RC5000:${device.name}] logout with persisted token OK`);
        } catch (e) {
          console.warn(`[RC5000:${device.name}] logout failed:`, e.message);
        }
      }

      db.clearDeviceSession(deviceId);
      sessions.delete(deviceId);
      await new Promise(r => setTimeout(r, 500));
      return login(deviceId, true);
    }
  }

  if (response.status !== 200) {
    throw new Error(`Login failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }

  const token = response.data.token || response.data.accessToken || response.data.access_token || response.data.bearerToken;
  if (!token) {
    throw new Error(`Login succeeded but no token found in response: ${JSON.stringify(response.data)}`);
  }

  // Persist to DB and in-memory
  sessions.set(deviceId, { token, expiresAt: response.data.expiration || response.data.expiresAt });
  db.saveDeviceSession(deviceId, token);
  console.log(`[RC5000:${device.name}] login OK — token persisted`);

  return response.data;
}

async function logout(deviceId) {
  const token = getToken(deviceId);
  if (!token) return;

  try {
    const device = db.getDeviceById(deviceId);
    if (device) {
      const client = getClient(getBaseUrl(device), token);
      await client.post('/logout');
    }
  } catch (err) {
    console.warn(`[RC5000] logout warning:`, err.message);
  } finally {
    sessions.delete(deviceId);
    db.clearDeviceSession(deviceId);
  }
}

async function getStatus(deviceId) {
  const device = db.getDeviceById(deviceId);
  if (!device || !device.ip) return { status: 0, configured: false };
  const baseURL = getBaseUrl(device);
  const client = getClient(baseURL);
  const response = await client.get('/status');
  if (response.status !== 200) throw new Error(`Status failed — HTTP ${response.status}`);
  return response.data;
}

async function getHeartbeat(deviceId) {
  const device = getDeviceOrThrow(deviceId);
  const baseURL = getBaseUrl(device);
  console.log(`[RC5000:${device.name}] heartbeat → ${baseURL}/heartbeat`);
  const client = getClient(baseURL);
  const response = await client.get('/heartbeat');
  if (response.status !== 200) throw new Error(`Heartbeat failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  return response.data;
}

async function startPayinAmount(deviceId, amountCents) {
  if (sessions.get(deviceId)?.token) {
    try { await logout(deviceId); } catch {}
  }
  await login(deviceId);
  const device = getDeviceOrThrow(deviceId);
  const token = getToken(deviceId);
  const client = getClient(getBaseUrl(device), token);
  const response = await client.post('/operations/start', { type: OperationType.PayinAmount, amount: Math.round(amountCents) });
  if (response.status !== 200) throw new Error(`Start operation failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  return response.data;
}

async function startPayoutAmount(deviceId, amountCents) {
  if (sessions.get(deviceId)?.token) {
    try { await logout(deviceId); } catch {}
  }
  await login(deviceId);
  const device = getDeviceOrThrow(deviceId);
  const token = getToken(deviceId);
  const url = `${getBaseUrl(device)}/operations/start`;
  console.log(`[RC5000:${device.name}] payout → POST ${url} type=5 amount=${amountCents}`);
  const client = getClient(getBaseUrl(device), token);
  const response = await client.post('/operations/start', { type: OperationType.PayoutAmount, amount: Math.round(amountCents) });
  console.log(`[RC5000:${device.name}] payout response HTTP ${response.status}:`, JSON.stringify(response.data));
  if (response.status !== 200) throw new Error(`Start payout failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  return response.data;
}

async function getOperationStatus(deviceId, operationId) {
  const token = getToken(deviceId);
  if (!token) throw new Error('No active session for device');
  const device = getDeviceOrThrow(deviceId);
  const client = getClient(getBaseUrl(device), token);
  const response = await client.get(`/operations/status/${operationId}`);
  return response.data;
}

async function finishOperation(deviceId) {
  const token = getToken(deviceId);
  if (!token) throw new Error('No active session for device');
  const device = getDeviceOrThrow(deviceId);
  const client = getClient(getBaseUrl(device), token);
  const response = await client.post('/operations/finish');
  return response.data;
}

async function cancelOperation(deviceId) {
  const token = getToken(deviceId);
  if (!token) throw new Error('No active session for device');
  const device = getDeviceOrThrow(deviceId);
  const client = getClient(getBaseUrl(device), token);
  const response = await client.post('/operations/cancel');
  return response.data;
}

async function getContent(deviceId) {
  if (sessions.get(deviceId)?.token) {
    try { await logout(deviceId); } catch {}
  }
  await login(deviceId);
  const device = getDeviceOrThrow(deviceId);
  const token = getToken(deviceId);
  const client = getClient(getBaseUrl(device), token);
  try {
    const response = await client.get('/content/current');
    if (response.status !== 200) throw new Error(`Content failed — HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    return response.data;
  } finally {
    try { await logout(deviceId); } catch {}
  }
}

module.exports = {
  login, logout, getStatus, getHeartbeat,
  startPayinAmount, startPayoutAmount, getOperationStatus, finishOperation, cancelOperation,
  getContent, sessions
};
