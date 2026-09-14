const axios = require('axios');
const { createOAuthClient } = require('./auth');
const { loadTokens, saveTokens } = require('./tokens');

const BASE_URL = 'https://health.googleapis.com/v4';

// La URL del path usa guiones; el filtro usa guion_bajo
const DATA_TYPES = {
  steps:     { path: 'steps',      filter: 'steps' },
  sleep:     { path: 'sleep',      filter: 'sleep' },
  heartRate: { path: 'heart-rate', filter: 'heart_rate' },
  exercise:  { path: 'exercise',   filter: 'exercise' },
};

async function getValidToken() {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('No hay tokens guardados. Visita /auth/start para autorizar primero.');
  }

  const client = createOAuthClient();
  client.setCredentials(tokens);

  // getAccessToken() refresca automáticamente si el token expiró
  const { token } = await client.getAccessToken();

  // Guardar credenciales actualizadas si cambiaron
  if (client.credentials.access_token !== tokens.access_token) {
    saveTokens(client.credentials);
  }

  return token;
}

function buildFilter(filterName, startDate, endDate) {
  return (
    `${filterName}.interval.civil_start_time >= "${startDate}T00:00:00" ` +
    `AND ${filterName}.interval.civil_start_time < "${endDate}T23:59:59"`
  );
}

async function queryDataType(pathName, filterName, startDate, endDate, accessToken) {
  try {
    const response = await axios.get(
      `${BASE_URL}/users/me/dataTypes/${pathName}/dataPoints`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { filter: buildFilter(filterName, startDate, endDate) },
      }
    );
    return response.data;
  } catch (err) {
    console.error(`[healthApi] Error en ${pathName}:`, err.response?.data ?? err.message);
    return { error: err.response?.data?.error?.message ?? err.message };
  }
}

async function fetchAllTypes(startDate, endDate) {
  const token = await getValidToken();

  const [steps, sleep, heartRate, exercise] = await Promise.all([
    queryDataType(DATA_TYPES.steps.path,     DATA_TYPES.steps.filter,     startDate, endDate, token),
    queryDataType(DATA_TYPES.sleep.path,     DATA_TYPES.sleep.filter,     startDate, endDate, token),
    queryDataType(DATA_TYPES.heartRate.path, DATA_TYPES.heartRate.filter, startDate, endDate, token),
    queryDataType(DATA_TYPES.exercise.path,  DATA_TYPES.exercise.filter,  startDate, endDate, token),
  ]);

  return { steps, sleep, heartRate, exercise };
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

async function getTodayData() {
  const today = toDateStr(new Date());
  const data = await fetchAllTypes(today, today);
  return { date: today, ...data };
}

async function getWeekData() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  const todayStr = toDateStr(today);
  const weekAgoStr = toDateStr(weekAgo);

  const data = await fetchAllTypes(weekAgoStr, todayStr);
  return { from: weekAgoStr, to: todayStr, ...data };
}

module.exports = { getTodayData, getWeekData };
