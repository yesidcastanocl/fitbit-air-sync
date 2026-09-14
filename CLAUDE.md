# CLAUDE.md — Fitbit Air Sync

## Qué es este proyecto

Backend Node.js/Express que conecta un **Fitbit Air** (o cualquier dispositivo Fitbit) con la **Google Health API** para exponer datos de salud via endpoints REST, con un **dashboard web público** para compartir con amigos. Desplegado en **Railway**.

## Stack

- **Runtime:** Node.js ≥ 18 con Express
- **Auth:** OAuth 2.0 via `google-auth-library`
- **API:** Google Health API v4 (`https://health.googleapis.com/v4`)
- **Dashboard:** HTML/CSS/JS estático servido desde `public/index.html`
- **Spreadsheet:** Google Sheets via Sheets API (sync automático)
- **Cron:** `node-cron` — auto-sync cada 2 horas de 8 AM a 10 PM (zona Santiago)
- **Deploy:** Railway (proyecto: `fitbit-air-sync`, ID: `7dc55ed8-2cbe-4050-bd64-f2443937a5e7`)
- **Repo:** https://github.com/yesidcastanocl/fitbit-air-sync

## URLs públicas

| URL | Descripción |
|---|---|
| `https://trustworthy-abundance-production-7a2c.up.railway.app/` | Dashboard visual (compartir con amigos) |
| `https://trustworthy-abundance-production-7a2c.up.railway.app/data/today/analysis` | JSON con análisis completo del día |
| `https://trustworthy-abundance-production-7a2c.up.railway.app/data/today` | JSON datos crudos de Fitbit del día |
| `https://trustworthy-abundance-production-7a2c.up.railway.app/data/week` | JSON datos de los últimos 7 días |

## Endpoints API

| Endpoint | Descripción |
|---|---|
| `GET /` | Dashboard HTML (index.html de `public/`) |
| `GET /api` | Healthcheck JSON — lista endpoints |
| `GET /auth/start` | Genera la URL de autorización Google y redirige |
| `GET /oauth/callback` | Recibe el código de Google, guarda tokens, devuelve comando backup |
| `GET /data/today` | Datos crudos del día: pasos, sueño, frecuencia cardíaca, ejercicio |
| `GET /data/week` | Mismos datos de los últimos 7 días |
| `GET /data/today/analysis` | Análisis completo: plan, recuperación, pasos, LISS, nutrición, recomendación |
| `GET /sheets/setup` | Crea/configura la hoja de Google Sheets |
| `GET /sheets/sync` | Sincroniza datos del día a Sheets |

## Estructura de archivos

```
fitbit-air-sync/
├── server.js            — Express principal + cron
├── public/
│   └── index.html       — Dashboard visual (se sirve en /)
├── src/
│   ├── auth.js          — OAuth2 Google
│   ├── tokens.js        — Carga/guarda tokens (archivo + env var)
│   ├── healthApi.js     — Consultas a Google Health API v4
│   ├── analysis.js      — Lógica de análisis: plan, recuperación, LISS, nutrición
│   └── sheetsApi.js     — Integración con Google Sheets
├── railway.json
└── CLAUDE.md
```

## Dashboard (public/index.html)

Página web oscura y moderna que muestra en tiempo real:
- **Entrenamiento de hoy** — grupo muscular según el día de la semana
- **Recuperación** — score 0–100 basado en sueño (sueño total + profundo + REM)
- **Pasos** — con barra de progreso hacia 10.000 pasos
- **LISS Cardio** — minutos completados vs. requeridos según el plan
- **Nutrición** — TMB (1.556 kcal), objetivo (1.850 kcal), déficit (600 kcal)
- **Plan semanal completo** — con el día actual resaltado
- **Recomendación del día** — generada automáticamente según los datos
- **Auto-refresh** cada 5 minutos

## Plan de entrenamiento (codificado en `src/analysis.js`)

| Día | Músculos | LISS |
|---|---|---|
| Lunes | Hombro + Tríceps | 45 min |
| Martes | Espalda + Pectoral | 40 min |
| Miércoles | Hombro + Abdomen | 30 min |
| Jueves | Pierna + Bíceps | 45 min |
| Viernes | Hombro + Abdomen | 50 min |
| Sábado | Descanso | — |
| Domingo | Descanso | — |

## Perfil nutricional (codificado en `src/analysis.js`)

- **TMB:** 1.556 kcal
- **Mantenimiento:** 2.450 kcal
- **Objetivo (déficit):** 1.850 kcal (déficit de 600 kcal/día)

## Score de recuperación (lógica en `src/analysis.js`)

| Componente | Peso | Referencia perfecta |
|---|---|---|
| Sueño total | 40 pts | 480 min (8h) |
| Sueño profundo | 35 pts | 90 min |
| REM | 25 pts | 90 min |

| Score | Etiqueta |
|---|---|
| ≥ 85 | Recuperación óptima |
| ≥ 65 | Recuperación buena |
| ≥ 45 | Recuperación moderada |
| < 45 | Recuperación insuficiente |

## Variables de entorno en Railway

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://[dominio-railway]/oauth/callback` |
| `TOKEN_JSON` | Tokens OAuth en Base64 (se genera automáticamente tras auth) |
| `SPREADSHEET_ID` | ID de la hoja de Google Sheets (se genera con `/sheets/setup`) |

## Scopes OAuth correctos (crítico)

```
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
```

**Importante:** El prefijo es `googlehealth`, NO `health`. Error frecuente al configurar.

## Filtros de la API por dataType (aprendizaje clave)

| DataType | URL path | Filtro campo | Tipo de tiempo |
|---|---|---|---|
| Pasos | `steps` | `steps.interval.civil_start_time` | interval |
| Sueño | `sleep` | `sleep.interval.civil_end_time` | interval (end, no start) |
| Frecuencia cardíaca | `heart-rate` | No soporta filtro por fecha | Se filtra client-side |
| Ejercicio | `exercise` | `exercise.interval.civil_start_time` | interval |

## Persistencia de tokens en Railway

Railway tiene filesystem efímero: los archivos desaparecen en cada redeploy.
Solución implementada:

1. Tras autorizar en `/auth/start`, el callback devuelve un campo `command`
2. Ejecutar ese comando para guardar TOKEN_JSON como variable de entorno Railway
3. Al iniciar, el servidor carga primero desde archivo, luego desde env var TOKEN_JSON

## Flujo de re-autorización (si TOKEN_JSON expira)

El refresh_token dura ~7 días sin uso. Si expira:
1. Ir a `https://trustworthy-abundance-production-7a2c.up.railway.app/auth/start`
2. Autorizar con la cuenta Google del Fitbit
3. Copiar el valor de `TOKEN_JSON` del JSON de respuesta
4. Ejecutar: `railway variables set TOKEN_JSON="[valor]"`

## Auto-sync a Google Sheets

Cron configurado en `server.js`: cada 2 horas entre 8 AM y 10 PM (hora Santiago).
- Solo registra sesión de ejercicio si se detecta actividad ≥ 30 min (modo inteligente)
- Endpoint manual: `/sheets/sync`

## Deploy

```bash
# Push a GitHub → Railway despliega automáticamente
git push origin master

# Ver logs en Railway
railway logs

# Setear variable de entorno
railway variables set VARIABLE="valor"
```

## Credenciales (guardadas en memoria del proyecto)

- Google Cloud Project: `mi-fitbit-air`
- Railway URL: `https://trustworthy-abundance-production-7a2c.up.railway.app`
- Ver `C:\Users\OFIMATICA-22\.claude\projects\C--Users-OFIMATICA-22-OneDrive-Fitbit-Air\memory\project_fitbit_credentials.md`
