# Guía completa: Conectar Fitbit Air a Google Health API

**Proyecto:** Fitbit Air Sync — backend REST para datos de salud  
**Autor:** XetorIA  
**Fecha:** Septiembre 2026  
**Aplicable a:** Cualquier dispositivo Fitbit (Air, Sense, Charge, Versa, etc.)

---

## Contexto importante antes de empezar

En **septiembre de 2026**, Google (dueño de Fitbit desde 2021) deprecó la Fitbit Web API completamente. La reemplazó con la **Google Health API**. Si intentas usar el portal antiguo (`dev.fitbit.com/apps`) ya no funciona como antes — te redirige a una página de "getting started" sin opciones claras.

**Todo lo que aquí se documenta usa Google Health API, no Fitbit Web API.**

---

## Requisitos previos

- Cuenta Google vinculada al dispositivo Fitbit (la app de Fitbit en el celular usa tu cuenta Google)
- Acceso a Google Cloud Console
- Node.js ≥ 18 instalado localmente
- Railway CLI instalado (`npm install -g @railway/cli`) y autenticado (`railway login`)
- GitHub CLI instalado y autenticado (`gh auth login`)

---

## PASO 1 — Google Cloud Console: crear proyecto y habilitar API

### 1.1 Crear o seleccionar proyecto
1. Ve a **console.cloud.google.com**
2. Crea un proyecto nuevo (ej: `Mi Fitbit Air`) o selecciona uno existente
3. Anota el **Project ID** (lo necesitas después)

### 1.2 Habilitar Google Health API
1. En el menú lateral: **APIs y servicios → Biblioteca**
2. Busca `Google Health API`
3. Haz clic en **Habilitar**

> ⚠️ **Error frecuente #1:** Si olvidas habilitar la API, el OAuth falla con `invalid_scope` aunque las credenciales sean correctas.

### 1.3 Configurar la pantalla de consentimiento OAuth
1. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo**
3. Completa nombre de app, email de soporte, email de desarrollador
4. En **Scopes**, NO es necesario agregar nada manualmente — Google los reconoce al momento del auth
5. En **Usuarios de prueba**, agrega el email de la cuenta Google del Fitbit

> ⚠️ **Error frecuente #2:** Si no agregas el email como usuario de prueba, Google devuelve `Error 403: access_denied` con el mensaje "la app no completó el proceso de verificación de Google". La solución NO es verificar la app — es agregar el usuario de prueba.

### 1.4 Crear credenciales OAuth 2.0
1. Ve a **APIs y servicios → Credenciales**
2. Clic en **+ Crear credenciales → ID de cliente de OAuth 2.0**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `fitbit-air-sync` (o el que prefieras)
5. En **URIs de redireccionamiento autorizados**, agrega:
   ```
   https://[tu-dominio-railway]/oauth/callback
   http://localhost:3000/oauth/callback
   ```
   > ⚠️ **Error frecuente #3:** La URL exacta del dominio de Railway se conoce DESPUÉS de hacer el primer deploy. Puedes poner un placeholder y actualizarlo después. Railway genera dominios tipo `nombre-random-production-xxxx.up.railway.app`.
6. Guarda y copia el **Client ID** y **Client Secret**

---

## PASO 2 — Crear el proyecto Node.js

### Estructura de archivos

```
fitbit-air-sync/
├── server.js          # Express + 4 endpoints
├── src/
│   ├── auth.js        # OAuth 2.0 (URL de auth + intercambio de código)
│   ├── tokens.js      # Guardar/leer tokens (archivo + env var fallback)
│   └── healthApi.js   # Llamadas a Google Health API
├── package.json
├── railway.json       # Configuración de deploy
├── .env               # Variables locales (NO subir a git)
├── .env.example       # Plantilla de variables
└── .gitignore         # Excluye .env y tokens.json
```

### package.json — dependencias clave

```json
{
  "dependencies": {
    "axios": "^1.7.0",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "google-auth-library": "^9.11.0"
  },
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18.0.0" }
}
```

### Los scopes correctos (src/auth.js)

```javascript
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
];
```

> ⚠️ **Error frecuente #4:** Los scopes incorrectos más comunes que se documentan en fuentes desactualizadas:
> - ❌ `https://www.googleapis.com/auth/health.activity` (prefijo `health` incorrecto)
> - ❌ `https://www.googleapis.com/auth/fitness.activity.read` (esos son Google Fit, no Google Health)
> - ✅ El prefijo correcto es `googlehealth` (todo junto)

### Filtros de la API por tipo de dato (src/healthApi.js)

Esta es la parte más crítica y menos documentada. Cada tipo de dato usa un esquema de filtro diferente:

```javascript
const DATA_TYPES = {
  steps: {
    path: 'steps',
    filterPrefix: 'steps',
    timeType: 'interval',
    timeField: 'civil_start_time'   // usa start
  },
  sleep: {
    path: 'sleep',
    filterPrefix: 'sleep',
    timeType: 'interval',
    timeField: 'civil_end_time'     // usa END (no start — error frecuente)
  },
  heartRate: {
    path: 'heart-rate',             // guión en la URL
    noFilter: true                  // NO soporta filtro por fecha
  },
  exercise: {
    path: 'exercise',
    filterPrefix: 'exercise',
    timeType: 'interval',
    timeField: 'civil_start_time'
  },
};
```

> ⚠️ **Error frecuente #5 — Sleep:** Usar `civil_start_time` en lugar de `civil_end_time` devuelve `INVALID_DATA_POINT_FILTER_DATA_TYPE_MEMBER`.

> ⚠️ **Error frecuente #6 — Heart Rate:** El tipo `heart-rate` NO acepta filtro de fecha. Si intentas filtrar devuelve `INVALID_DATA_POINT_FILTER_DATA_TYPE_RESTRICTION`. La solución es consultarlo sin filtro y recortar por fecha en el servidor.

> ⚠️ **Error frecuente #7 — Heart Rate guión:** El filtro de heart rate usa `heart-rate` con guión (igual que la URL), no `heart_rate` con guión bajo.

### Formato del filtro

```
{prefix}.{timeType}.{timeField} >= "YYYY-MM-DDTHH:MM:SS"
```

Ejemplo para pasos:
```
steps.interval.civil_start_time >= "2026-09-14T00:00:00" AND steps.interval.civil_start_time < "2026-09-14T23:59:59"
```

---

## PASO 3 — Deploy en Railway

### 3.1 Inicializar proyecto Railway
```bash
cd tu-carpeta-proyecto
railway login           # si no estás autenticado
railway init            # crea el proyecto en Railway
```

> **Nota:** Railway genera un nombre aleatorio al proyecto (ej: `trustworthy-abundance`). Puedes renombrarlo después via su API GraphQL:
> ```bash
> curl -X POST https://backboard.railway.app/graphql/v2 \
>   -H "Authorization: Bearer [tu-token-railway]" \
>   -H "Content-Type: application/json" \
>   -d '{"query": "mutation { projectUpdate(id: \"[project-id]\", input: { name: \"fitbit-air-sync\" }) { id name } }"}'
> ```
> El token Railway está en `~/.railway/config.json` bajo `user.accessToken`.

### 3.2 Primer deploy (necesario antes de configurar variables)
```bash
railway up --detach
```

### 3.3 Configurar variables de entorno
```bash
railway variables set \
  GOOGLE_CLIENT_ID="tu-client-id" \
  GOOGLE_CLIENT_SECRET="tu-client-secret" \
  GOOGLE_REDIRECT_URI="https://[dominio-railway]/oauth/callback"
```

### 3.4 Obtener el dominio público
```bash
railway domain
```
Esto devuelve la URL tipo `https://nombre-production-xxxx.up.railway.app`.

> ⚠️ **Paso crítico:** Una vez que conoces el dominio Railway, debes volver a Google Cloud Console y agregar esa URL exacta como Redirect URI autorizado.

---

## PASO 4 — Primera autorización

### 4.1 Abrir el flujo OAuth
Navega a: `https://[tu-dominio-railway]/auth/start`

Google redirige a la pantalla de consentimiento.

### 4.2 Errores comunes durante la autorización

| Error | Causa | Solución |
|---|---|---|
| `invalid_scope` | Scopes incorrectos o API no habilitada | Verificar scopes con prefijo `googlehealth`; habilitar Google Health API |
| `Error 403: access_denied` | Email no está en usuarios de prueba | Agregar email en Pantalla de consentimiento → Usuarios de prueba |
| `Error 400: redirect_uri_mismatch` | La URL del callback no coincide exactamente | Actualizar Redirect URI en Google Cloud Console |
| `Se produjo un error` (genérico) | Código OAuth ya usado o caducado | Abrir `/auth/start` de nuevo en ventana incógnita |

### 4.3 Guardar tokens para que sobrevivan redeploys

Cuando la autorización es exitosa, el endpoint `/oauth/callback` devuelve:
```json
{
  "message": "✅ Autorización exitosa. Tokens guardados.",
  "next": "Ejecuta este comando para hacer los tokens permanentes:",
  "command": "railway variables set TOKEN_JSON=\"[base64-largo]\""
}
```

**Ejecuta ese comando inmediatamente.** Esto guarda los tokens como variable de entorno en Railway.

> ⚠️ **Por qué es necesario:** Railway tiene filesystem efímero — cualquier redeploy borra los archivos locales del servidor, incluyendo `tokens.json`. Al guardar TOKEN_JSON como variable de entorno, los tokens persisten indefinidamente.

---

## PASO 5 — Verificar que todo funciona

```bash
# Datos de hoy
curl https://[tu-dominio-railway]/data/today

# Datos de la semana
curl https://[tu-dominio-railway]/data/week
```

Respuesta esperada `/data/today`:
```json
{
  "date": "2026-09-14",
  "steps": { "dataPoints": [...] },
  "sleep": { "dataPoints": [{ "sleep": { "summary": { "minutesAsleep": 446 } } }] },
  "heartRate": { "dataPoints": [...] },
  "exercise": { "dataPoints": [] }
}
```

---

## Mantenimiento y casos especiales

### Cuándo necesitas re-autorizar
El `refresh_token` expira si no se usa durante **7 días**. Cuando expira:
1. Ve a `/auth/start` y autoriza de nuevo
2. Copia el valor de `TOKEN_JSON` del JSON de respuesta
3. Ejecuta: `railway variables set TOKEN_JSON="[valor]"`

### Si cambias de dispositivo Fitbit
El proceso es idéntico — los datos se asocian a la cuenta Google, no al dispositivo físico.

### Si despliegas para otro usuario
Cada usuario necesita su propia app OAuth (sus propias credenciales en Google Cloud Console) y su propia autorización. No es posible compartir tokens entre cuentas.

---

## Posibilidades de expansión (lo que se puede hacer con esta API)

### Para uso personal
- **Dashboard de salud** — conectar este backend a un frontend (React, Notion, Google Sheets)
- **Alertas automáticas** — si los pasos diarios bajan de X, enviar notificación
- **Registro histórico** — guardar datos diarios en una base de datos (Supabase, PlanetScale)

### Como servicio XetorIA para deportistas
- Backend multi-tenant (un endpoint por usuario, tokens aislados)
- Integración con Zoho CRM: crear actividad automática cuando el cliente hace ejercicio
- Reporte semanal automatizado por email via Zoho Campaigns
- Dashboard en Notion o Google Sheets con datos del atleta
- Alertas de recuperación: si el sueño profundo baja, sugerir descanso

### Datos disponibles en la API
| Métrica | Detalle disponible |
|---|---|
| **Pasos** | Por minuto, fuente (Fitbit, Apple Health, etc.) |
| **Sueño** | Etapas (LIGHT, DEEP, REM, AWAKE), duración, despertares |
| **Frecuencia cardíaca** | Múltiples registros diarios |
| **Ejercicio** | Tipo de actividad, duración, intensidad |

---

## Lecciones aprendidas del proceso de integración

1. **La documentación oficial de Google Health API está incompleta** al momento de esta guía (septiembre 2026). Muchos filtros y nombres de campos hay que descubrirlos por prueba y error o consultando el discovery document directamente: `https://health.googleapis.com/$discovery/rest?version=v4`

2. **Los scopes son la barrera más común.** La confusión entre Google Fit (`fitness.*`), Fitbit Web API (`health.*`) y Google Health API (`googlehealth.*`) hace que la mayoría de los tutoriales desactualizados fallen.

3. **Railway + archivos = problema.** Para cualquier dato que deba persistir (tokens, configuración, base de datos), usar variables de entorno o un servicio externo de storage. El filesystem de Railway es efímero por diseño.

4. **Cada dataType de la API tiene su propio esquema de filtro.** No hay un patrón uniforme — hay que verificar campo por campo.

5. **La pantalla de consentimiento OAuth es un paso que se olvida.** La app debe estar en modo "producción" O tener el email del usuario en la lista de prueba. Sin esto, `access_denied` siempre.

---

## Recursos útiles

- Google Health API Discovery Document: `https://health.googleapis.com/$discovery/rest?version=v4`
- Google Cloud Console: `console.cloud.google.com`
- Railway Dashboard: `railway.app`
- Repo del proyecto: `https://github.com/yesidcastanocl/fitbit-air-sync`
