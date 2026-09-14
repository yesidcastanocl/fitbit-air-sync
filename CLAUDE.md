# CLAUDE.md — Fitbit Air Training Dashboard

> **Para el equipo / Para la IA:** Este documento describe completamente el proyecto. Al cargarlo, tienes todo el contexto para continuar el desarrollo sin preguntar nada básico.

---

## Qué es este proyecto

Dashboard personal de salud y entrenamiento de **Yesid Castaño**. Conecta un **Fitbit Air** con la **Google Health API** para mostrar datos en tiempo real en una web pública, bonita y compartible con amigos.

**URL pública:**
```
https://trustworthy-abundance-production-7a2c.up.railway.app
```

**Repositorio GitHub:**
```
https://github.com/yesidcastanocl/fitbit-air-sync
```

---

## Stack actual

| Capa | Tecnología |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js |
| Auth | OAuth 2.0 via `google-auth-library` |
| Datos fitness | Google Health API v4 |
| Datos nutrición | Google Sheets API (almacenamiento manual por ahora) |
| Frontend | HTML/CSS/JS vanilla en `public/index.html` — sin build step |
| Tipografías | Space Grotesk (títulos) + Inter (cuerpo) vía Google Fonts |
| Cron | `node-cron` — auto-sync a Sheets cada 2h |
| Deploy | Railway (auto-deploy desde GitHub push) |
| Proyecto GCP | `mi-fitbit-air` |

---

## Estructura de archivos

```
fitbit-air-sync/
├── server.js              — Express + cron + rutas
├── public/
│   └── index.html         — Dashboard visual público (se sirve en /)
├── src/
│   ├── auth.js            — OAuth2 Google (client_id, secret, redirect)
│   ├── tokens.js          — Carga tokens desde archivo o env var TOKEN_JSON
│   ├── healthApi.js       — Consultas a Google Health API (steps, sleep, HR, exercise)
│   ├── analysis.js        — Lógica: plan de entrenamiento, score recuperación, LISS, nutrición
│   └── sheetsApi.js       — Sync diario a Google Sheets
├── .env.example           — Variables de entorno de referencia
├── railway.json           — Config de Railway
└── CLAUDE.md              — Este archivo
```

---

## Endpoints del servidor

| Método + Ruta | Descripción |
|---|---|
| `GET /` | Sirve `public/index.html` (dashboard visual) |
| `GET /api` | Healthcheck JSON — lista todos los endpoints |
| `GET /auth/start` | Inicia flujo OAuth Google → redirige al usuario |
| `GET /oauth/callback` | Recibe código OAuth, guarda tokens, devuelve comando backup |
| `GET /data/today` | Datos crudos Fitbit del día (steps, sleep, HR, exercise) |
| `GET /data/week` | Datos crudos de los últimos 7 días |
| `GET /data/today/analysis` | Análisis completo del día (plan + recuperación + LISS + nutrición + recomendación) |
| `GET /sheets/setup` | Crea/verifica la hoja de Google Sheets |
| `GET /sheets/sync` | Sync manual del día a Sheets |

---

## Variables de entorno en Railway

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud Console (proyecto `mi-fitbit-air`) |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://trustworthy-abundance-production-7a2c.up.railway.app/oauth/callback` |
| `TOKEN_JSON` | Tokens OAuth en Base64 (se genera con `/auth/start` → `/oauth/callback`) |
| `SPREADSHEET_ID` | ID de la hoja de Sheets (se genera con `/sheets/setup`) |

---

## Scopes OAuth (crítico — no cambiar)

```
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
```

**⚠ El prefijo es `googlehealth`, NO `health`. Error frecuente.**

---

## Filtros de la Google Health API (aprendizaje clave)

| DataType | URL path | Campo de filtro | Nota |
|---|---|---|---|
| Pasos | `steps` | `steps.interval.civil_start_time` | Interval filter |
| Sueño | `sleep` | `sleep.interval.civil_end_time` | Usar END, no start |
| Frecuencia cardíaca | `heart-rate` | ❌ Sin filtro de fecha | Filtrar client-side |
| Ejercicio | `exercise` | `exercise.interval.civil_start_time` | Interval filter |

---

## Plan de entrenamiento de Yesid (en `src/analysis.js`)

| Día | Músculos | LISS objetivo |
|---|---|---|
| Lunes | Hombro + Tríceps | 45 min |
| Martes | Espalda + Pectoral | 40 min |
| Miércoles | Hombro + Abdomen | 30 min |
| Jueves | Pierna + Bíceps | 45 min |
| Viernes | Hombro + Abdomen | 50 min |
| Sábado | Descanso | — |
| Domingo | Descanso | — |

## Perfil nutricional de Yesid (en `src/analysis.js`)

- **TMB:** 1.556 kcal
- **Mantenimiento:** 2.450 kcal
- **Objetivo (déficit):** 1.850 kcal → déficit de 600 kcal/día
- **Fase:** Definición (pérdida de grasa preservando músculo)

---

## Score de recuperación (lógica en `src/analysis.js`)

Escala 0–100 basada en 3 componentes del sueño:

| Componente | Peso máx | Referencia óptima |
|---|---|---|
| Sueño total | 40 pts | 8 horas (480 min) |
| Sueño profundo | 35 pts | 90 min |
| REM | 25 pts | 90 min |

| Score | Etiqueta |
|---|---|
| ≥ 85 | Recuperación óptima — máxima intensidad |
| ≥ 65 | Recuperación buena |
| ≥ 45 | Recuperación moderada — bajar intensidad |
| < 45 | Recuperación insuficiente — considera descanso |

---

## Dashboard visual (public/index.html) — Estado actual

Página web oscura premium con:
- **Header sticky** con live badge pulsante
- **Nav pills** con scroll activo automático (Hoy / Mes / Plan / Nutrición)
- **Hero card** con gradiente, nombre del grupo muscular y glow de color por tipo
- **Ring de recuperación** SVG animado con gradiente naranja→verde
- **Métricas** (3 cards): recuperación + pasos + LISS con barras de progreso animadas
- **Desglose de sueño** (total, profundo, REM)
- **Calendario mensual** interactivo con navegación anterior/siguiente
  - Días coloreados por tipo de entrenamiento
  - Hoy resaltado con borde naranja
  - Click en cualquier día → sheet deslizante desde abajo con detalle
- **Plan semanal** con barras de color por tipo
- **Nutrición** con barra animada TMB/objetivo/mantenimiento
- **Recomendación del día** generada desde los datos reales del Fitbit
- Auto-refresh cada 5 minutos
- Totalmente responsive (mobile-first)
- Animaciones: fade-up con IntersectionObserver, ring SVG, contador de pasos

---

## Persistencia de tokens en Railway

Railway tiene filesystem efímero (se borra en cada redeploy). Solución:
1. Visitar `/auth/start` → autorizar con la cuenta Google del Fitbit
2. El callback devuelve un campo `command` con el valor TOKEN_JSON en Base64
3. Ejecutar ese comando en terminal: `railway variables set TOKEN_JSON="[valor]"`
4. Al iniciar, el servidor lee primero el archivo `tokens.json`, si no existe lee `TOKEN_JSON` del entorno

El refresh_token expira ~7 días sin uso. Flujo de re-auth:
1. Ir a `https://trustworthy-abundance-production-7a2c.up.railway.app/auth/start`
2. Autorizar
3. `railway variables set TOKEN_JSON="[valor del campo command]"`

---

## Credenciales (no incluir en código)

- Google Cloud Project: `mi-fitbit-air`
- Railway URL: `https://trustworthy-abundance-production-7a2c.up.railway.app`
- Ver credenciales en: `C:\Users\OFIMATICA-22\.claude\projects\C--Users-OFIMATICA-22-OneDrive-Fitbit-Air\memory\project_fitbit_credentials.md`

---

## Deploy

```bash
# Cualquier push a master → Railway redespliega automáticamente
git push origin master

# Ver logs en tiempo real
railway logs

# Setear variable de entorno
railway variables set VARIABLE="valor"
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## VISIÓN Y ROADMAP — Lo que viene
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este proyecto está pensado para crecer en estas dimensiones:

---

### 📸 MÓDULO DE NUTRICIÓN CON IA (Alta prioridad)

**Concepto:** Yesid saca foto a su comida → el sistema identifica alimentos, pide pesos, calcula macros.

**Flujo:**
1. Botón en el dashboard → abre cámara/galería del teléfono
2. La imagen se envía a Claude Vision API (claude-sonnet-4-6) con prompt especializado
3. Claude devuelve lista de alimentos identificados + pesos estimados
4. Usuario puede editar los pesos (inputs numéricos)
5. Sistema calcula: calorías, proteínas (g), carbohidratos (g), grasas (g), azúcar (g)
6. Se acumula en el total diario y se compara vs el objetivo (1.850 kcal)
7. Se guarda en Google Sheets para histórico

**Endpoint a crear:** `POST /food/analyze` — recibe `{ imageBase64, mimeType }`

**Dependencias a instalar:**
```bash
npm install @anthropic-ai/sdk multer
```

**Variables de entorno a agregar:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Prompt base para Claude Vision:**
```
Analiza esta imagen de comida. Identifica cada alimento visible.
Para cada uno devuelve: nombre, peso estimado en gramos, y macronutrientes por 100g
(calorías, proteínas, carbohidratos, grasas, azúcar).
Responde SOLO en JSON con esta estructura:
{ "foods": [{ "name": "", "estimatedGrams": 0, "per100g": { "kcal":0,"protein":0,"carbs":0,"fat":0,"sugar":0 } }] }
```

---

### 📊 ANÁLISIS AVANZADO DE DATOS (Media prioridad)

**Qué agregar a `/data/today/analysis` y al dashboard:**

1. **Frecuencia cardíaca en reposo** — ya viene de la API (`heartRate` en `healthApi.js`), solo falta exponerla en el análisis y mostrarla en el dashboard como card adicional
2. **Zonas de FC** — calcular % de tiempo en cada zona (reposo, fat-burn, cardio, pico) si el Fitbit lo reporta
3. **Consumo de azúcar** — actualmente no viene de Fitbit (el dispositivo no lo mide directamente). Vendrá del módulo de nutrición con IA cuando esté activo
4. **Calorías quemadas** — Google Health API puede devolver calorías activas vs. basales

**Para agregar frecuencia cardíaca al análisis**, modificar `src/analysis.js`:
```js
function calcHeartRate(hrData) {
  const points = hrData?.dataPoints ?? [];
  if (!points.length) return { avg: 0, resting: 0 };
  const vals = points.map(p => p.heartRate?.beatsPerMinute ?? 0).filter(v => v > 0);
  const avg = vals.length ? Math.round(vals.reduce((s,v) => s+v, 0) / vals.length) : 0;
  const resting = Math.min(...vals) || 0;
  return { avg, resting, dataPoints: vals.length };
}
```

---

### 🗓️ HISTÓRICO MENSUAL REAL (Media prioridad)

Actualmente el calendario muestra el plan teórico (determinístico por día de semana). Para mostrar si realmente entrenó cada día:

- Guardar en Google Sheets una fila por día con `hasTrainingSession` + `liss.done`
- Nuevo endpoint: `GET /data/history?from=YYYY-MM-DD&to=YYYY-MM-DD` — lee de Sheets
- Dashboard: colorear días del calendario con check si completó / X si no
- Requiere: `SPREADSHEET_ID` en Railway + `/sheets/setup` ejecutado

---

### 💬 RECOMENDACIONES CON CLAUDE (Baja prioridad / lujo)

En lugar de las recomendaciones basadas en `if/else` en `analysis.js`, usar Claude API:

**Endpoint:** `GET /data/today/ai-recommendation`

```js
const anthropic = new Anthropic();
const msg = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 300,
  messages: [{
    role: 'user',
    content: `Eres el coach personal de Yesid. Datos de hoy:
      Recuperación: ${score}/100 (${label})
      Sueño: ${totalHours}h (${deepMinutes}min profundo, ${remMinutes}min REM)
      Pasos: ${steps} (objetivo: 10.000)
      LISS completado: ${liss.completed}/${liss.required} min
      Entrenamiento de hoy: ${muscles}
      Calorías disponibles: ${deficitTarget}
      
      Dame UNA recomendación concisa (2-3 frases) personalizada y motivadora.`
  }]
});
```

---

### 🔒 AUTENTICACIÓN DEL DASHBOARD (Si se quiere privacidad)

Actualmente el dashboard es 100% público. Para agregar una contraseña simple:
- Middleware en Express que lee cookie de sesión
- Página de login con contraseña hardcodeada en Railway env var `DASHBOARD_PASSWORD`
- No necesita base de datos — JWT firmado con secret en cookie httpOnly

---

## Para el equipo — cómo retomar el trabajo

1. **Clonar repo:** `git clone https://github.com/yesidcastanocl/fitbit-air-sync`
2. **Instalar:** `npm install`
3. **Copiar `.env.example` a `.env`** y pedir credenciales a Yesid
4. **Ejecutar local:** `npm start` → http://localhost:3000
5. **El dashboard** está en `public/index.html` — editar directamente, no necesita build
6. **Los datos de fitness** vienen de la API al cargar la página
7. **Push a master** → Railway redespliega automáticamente en ~1 minuto

### Convenciones del proyecto

- No hay TypeScript — JavaScript puro para mantenerlo simple
- No hay frontend framework — HTML/CSS/JS vanilla en `public/`
- Los colores del dashboard están en CSS custom properties al inicio de `index.html`
- El plan de entrenamiento y el perfil nutricional están en `src/analysis.js` (editar ahí si cambian)
- Todos los endpoints de la API son `GET` sin autenticación (datos propios de Yesid)

---

## Historial de decisiones técnicas

| Decisión | Por qué |
|---|---|
| Railway en vez de Vercel | El backend Node.js con cron necesita un servidor persistente; Vercel mata los procesos |
| Google Health API en vez de Fitbit API directa | Fitbit Air sincroniza con Google Fit/Health automáticamente; evita OAuth doble |
| `express.static('public')` sirve el dashboard | Sin separar frontend/backend — menos infra, menos overhead |
| `TOKEN_JSON` en Base64 como env var | Railway tiene filesystem efímero; env vars son permanentes |
| Filtro de sueño por `civil_end_time` no `start_time` | Bug documentado: la API indexa el sueño por cuándo terminó, no cuándo empezó |
| `heart-rate` sin filtro de fecha | La endpoint no acepta filtros; se recorta client-side |
