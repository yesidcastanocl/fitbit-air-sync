# CLAUDE.md — Fitbit Air Sync

## Qué es este proyecto

Backend Node.js/Express que conecta un **Fitbit Air** (o cualquier dispositivo Fitbit) con la **Google Health API** para exponer datos de salud via endpoints REST. Diseñado para desplegarse en **Railway**.

## Stack

- **Runtime:** Node.js ≥ 18 con Express
- **Auth:** OAuth 2.0 via `google-auth-library`
- **API:** Google Health API v4 (`https://health.googleapis.com/v4`)
- **Deploy:** Railway (proyecto: `fitbit-air-sync`, ID: `7dc55ed8-2cbe-4050-bd64-f2443937a5e7`)
- **Repo:** https://github.com/yesidcastanocl/fitbit-air-sync

## Endpoints

| Endpoint | Descripción |
|---|---|
| `GET /` | Healthcheck — lista los endpoints disponibles |
| `GET /auth/start` | Genera la URL de autorización Google y redirige |
| `GET /oauth/callback` | Recibe el código de Google, guarda tokens, devuelve comando backup |
| `GET /data/today` | Resumen del día: pasos, sueño, frecuencia cardíaca, ejercicio |
| `GET /data/week` | Mismos datos de los últimos 7 días |

## Variables de entorno en Railway

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://[dominio-railway]/oauth/callback` |
| `TOKEN_JSON` | Tokens OAuth en Base64 (se genera automáticamente tras auth) |

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
1. Ir a `/auth/start`
2. Autorizar con la cuenta Google del Fitbit
3. Copiar el valor de `TOKEN_JSON` del JSON de respuesta
4. Ejecutar: `railway variables set TOKEN_JSON="[valor]"`

## Credenciales (guardadas en memoria del proyecto)

- Google Cloud Project: `mi-fitbit-air`
- Railway URL: `https://trustworthy-abundance-production-7a2c.up.railway.app`
- Ver `C:\Users\OFIMATICA-22\.claude\projects\C--Users-OFIMATICA-22-OneDrive-Fitbit-Air\memory\project_fitbit_credentials.md`
