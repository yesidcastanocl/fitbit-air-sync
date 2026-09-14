require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { getAuthUrl, exchangeCode } = require('./src/auth');
const { getTokensAsBase64 } = require('./src/tokens');
const { getTodayData, getWeekData } = require('./src/healthApi');
const { analyzeToday } = require('./src/analysis');
const { setupSpreadsheet, syncToSheet } = require('./src/sheetsApi');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    endpoints: [
      '/auth/start',
      '/oauth/callback',
      '/data/today',
      '/data/week',
      '/data/today/analysis',
      '/sheets/setup',
      '/sheets/sync',
    ],
  });
});

app.get('/auth/start', (_req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

app.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error, message: 'El usuario denegó el acceso o hubo un error en Google.' });
  }
  if (!code) {
    return res.status(400).json({ error: 'Falta el parámetro code en la respuesta de Google.' });
  }

  try {
    await exchangeCode(code);
    const b64 = getTokensAsBase64();
    res.json({
      message: '✅ Autorización exitosa. Tokens guardados.',
      next: 'Ejecuta este comando para hacer los tokens permanentes (sobreviven redeploys):',
      command: `railway variables set TOKEN_JSON="${b64}"`,
    });
  } catch (err) {
    console.error('[oauth/callback]', err.message);
    res.status(500).json({ error: 'Error al intercambiar el código por tokens.', detail: err.message });
  }
});

app.get('/data/today', async (_req, res) => {
  try {
    const data = await getTodayData();
    res.json(data);
  } catch (err) {
    console.error('[data/today]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/data/week', async (_req, res) => {
  try {
    const data = await getWeekData();
    res.json(data);
  } catch (err) {
    console.error('[data/week]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/data/today/analysis', async (_req, res) => {
  try {
    const data = await getTodayData();
    const analysis = analyzeToday(data);
    res.json({ date: data.date, ...analysis });
  } catch (err) {
    console.error('[data/today/analysis]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/sheets/setup', async (_req, res) => {
  try {
    const result = await setupSpreadsheet();
    res.json(result);
  } catch (err) {
    console.error('[sheets/setup]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/sheets/sync', async (_req, res) => {
  try {
    const data = await getTodayData();
    const analysis = analyzeToday(data);
    const result = await syncToSheet(data.date, analysis);
    res.json({ ...result, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID ?? '(ver /sheets/setup)'}` });
  } catch (err) {
    console.error('[sheets/sync]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Auto-sync cada 2 horas de 8 AM a 10 PM (hora Santiago)
// Solo escribe ejercicio si detecta sesión real >= 30 min
cron.schedule('0 8,10,12,14,16,18,20,22 * * *', async () => {
  console.log('[cron] Auto-sync iniciando...');
  try {
    const data = await getTodayData();
    const analysis = analyzeToday(data);
    const result = await syncToSheet(data.date, analysis, true); // smartMode = true
    console.log(`[cron] Auto-sync: ${result.action} — entrenamiento detectado: ${analysis.hasTrainingSession}`);
  } catch (err) {
    console.error('[cron] Error en auto-sync:', err.message);
  }
}, { timezone: 'America/Santiago' });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
