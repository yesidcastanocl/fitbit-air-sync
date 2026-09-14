require('dotenv').config();
const express = require('express');
const { getAuthUrl, exchangeCode } = require('./src/auth');
const { getTodayData, getWeekData } = require('./src/healthApi');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    endpoints: ['/auth/start', '/oauth/callback', '/data/today', '/data/week'],
  });
});

// Paso 1: redirige al consentimiento de Google
app.get('/auth/start', (_req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// Paso 2: Google redirige aquí con el código de autorización
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
    res.json({ message: '✅ Autorización exitosa. Tokens guardados. Ya puedes usar /data/today y /data/week.' });
  } catch (err) {
    console.error('[oauth/callback]', err.message);
    res.status(500).json({ error: 'Error al intercambiar el código por tokens.', detail: err.message });
  }
});

// Resumen del día actual
app.get('/data/today', async (_req, res) => {
  try {
    const data = await getTodayData();
    res.json(data);
  } catch (err) {
    console.error('[data/today]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Resumen de los últimos 7 días
app.get('/data/week', async (_req, res) => {
  try {
    const data = await getWeekData();
    res.json(data);
  } catch (err) {
    console.error('[data/week]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
