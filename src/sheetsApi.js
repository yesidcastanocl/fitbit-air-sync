const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getValidToken } = require('./healthApi');

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_FILE = path.join(__dirname, '..', 'spreadsheet_id.txt');

const HEADERS = [
  'Fecha', 'Día', 'Pasos', 'Pasos Estado',
  'Sueño Total (h)', 'Sueño Profundo (min)', 'REM (min)',
  'Score Recuperación', 'Estado Recuperación',
  'LISS Requerido (min)', 'LISS Completado (min)', 'LISS Hecho',
  'Músculos del Día', 'Recomendación',
];

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getSpreadsheetId() {
  if (process.env.SPREADSHEET_ID) return process.env.SPREADSHEET_ID;
  if (fs.existsSync(SPREADSHEET_FILE)) return fs.readFileSync(SPREADSHEET_FILE, 'utf8').trim();
  return null;
}

function saveSpreadsheetId(id) {
  fs.writeFileSync(SPREADSHEET_FILE, id);
}

async function createSpreadsheet(token) {
  const res = await axios.post(
    SHEETS_BASE,
    {
      properties: { title: 'Fitbit Air — Dashboard Personal' },
      sheets: [{
        properties: { title: 'Datos Diarios', sheetId: 0 },
        data: [{ rowData: [{ values: HEADERS.map(h => ({ userEnteredValue: { stringValue: h } })) }] }],
      }],
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data.spreadsheetId;
}

async function getExistingDates(spreadsheetId, token) {
  const res = await axios.get(
    `${SHEETS_BASE}/${spreadsheetId}/values/Datos%20Diarios!A2:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return (res.data.values ?? []).flat();
}

async function appendRow(spreadsheetId, row, token) {
  await axios.post(
    `${SHEETS_BASE}/${spreadsheetId}/values/Datos%20Diarios!A1:append?valueInputOption=USER_ENTERED`,
    { values: [row] },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

async function updateRow(spreadsheetId, rowIndex, row, token) {
  const range = `Datos%20Diarios!A${rowIndex}:N${rowIndex}`;
  await axios.put(
    `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    { values: [row] },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

async function setupSpreadsheet() {
  const token = await getValidToken();
  const id = await createSpreadsheet(token);
  saveSpreadsheetId(id);
  return {
    spreadsheetId: id,
    url: `https://docs.google.com/spreadsheets/d/${id}`,
    next: `Guarda el ID permanentemente: railway variables set SPREADSHEET_ID="${id}"`,
  };
}

async function syncToSheet(date, analysis, smartMode = false) {
  const token = await getValidToken();
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet no configurado. Ve a /sheets/setup primero.');

  // Smart mode: si es día de entrenamiento y no hay sesión detectada, deja campos de ejercicio vacíos
  const isTrainingDay = analysis.plan.lissMinutes > 0;
  const writeExercise = !smartMode || !isTrainingDay || analysis.hasTrainingSession;

  const dow = new Date(`${date}T12:00:00`).getDay();
  const row = [
    date,
    DAY_NAMES[dow],
    analysis.steps.total,
    analysis.steps.label,
    analysis.recovery.totalHours,
    analysis.recovery.deepMinutes,
    analysis.recovery.remMinutes,
    analysis.recovery.score,
    analysis.recovery.label,
    writeExercise ? analysis.liss.required   : '',
    writeExercise ? analysis.liss.completed  : '',
    writeExercise ? (analysis.liss.done ? 'Sí' : 'No') : 'Pendiente',
    analysis.plan.muscles,
    analysis.recommendation,
  ];

  const existingDates = await getExistingDates(spreadsheetId, token);
  const existingIndex = existingDates.indexOf(date);

  if (existingIndex !== -1) {
    // Row 1 = headers, row 2 = first data row → existingIndex 0 → row 2
    await updateRow(spreadsheetId, existingIndex + 2, row, token);
    return { action: 'updated', date, row: existingIndex + 2 };
  } else {
    await appendRow(spreadsheetId, row, token);
    return { action: 'appended', date };
  }
}

module.exports = { setupSpreadsheet, syncToSheet, getSpreadsheetId };
