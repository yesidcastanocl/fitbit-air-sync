const axios = require('axios');
const { createOAuthClient } = require('./auth');
const { loadTokens, saveTokens } = require('./tokens');

const BASE_URL = 'https://health.googleapis.com/v4';

// path: nombre en la URL; filterPrefix: prefijo del filtro; timeType: interval|sample_time; timeField: campo de tiempo
const DATA_TYPES = {
  steps:     { path: 'steps',      filterPrefix: 'steps',    timeType: 'interval',    timeField: 'civil_start_time' },
  sleep:     { path: 'sleep',      filterPrefix: 'sleep',    timeType: 'interval',    timeField: 'civil_end_time'   },
  heartRate: { path: 'heart-rate', noFilter: true }, // la API no permite filtrar heart-rate por fecha
  exercise:  { path: 'exercise',   filterPrefix: 'exercise', timeType: 'interval',    timeField: 'civil_start_time' },
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

function buildFilter({ filterPrefix, timeType, timeField }, startDate, endDate) {
  const field = `${filterPrefix}.${timeType}.${timeField}`;
  return `${field} >= "${startDate}T00:00:00" AND ${field} < "${endDate}T23:59:59"`;
}

async function queryDataType(type, startDate, endDate, accessToken) {
  try {
    const params = type.noFilter ? {} : { filter: buildFilter(type, startDate, endDate) };
    const response = await axios.get(
      `${BASE_URL}/users/me/dataTypes/${type.path}/dataPoints`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params }
    );

    // Para tipos sin filtro, recortamos por fecha en el servidor
    if (type.noFilter && response.data.dataPoints) {
      const start = new Date(`${startDate}T00:00:00`);
      const end   = new Date(`${endDate}T23:59:59`);
      response.data.dataPoints = response.data.dataPoints.filter(p => {
        const t = new Date(p.heartRate?.sampleTime?.physicalTime ?? p.heartRate?.sampleTime?.civilTime ?? 0);
        return t >= start && t <= end;
      });
    }

    return response.data;
  } catch (err) {
    console.error(`[healthApi] Error en ${type.path}:`, err.response?.data ?? err.message);
    return { error: err.response?.data?.error?.message ?? err.message };
  }
}

async function fetchAllTypes(startDate, endDate) {
  const token = await getValidToken();

  const [steps, sleep, heartRate, exercise] = await Promise.all([
    queryDataType(DATA_TYPES.steps,     startDate, endDate, token),
    queryDataType(DATA_TYPES.sleep,     startDate, endDate, token),
    queryDataType(DATA_TYPES.heartRate, startDate, endDate, token),
    queryDataType(DATA_TYPES.exercise,  startDate, endDate, token),
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
