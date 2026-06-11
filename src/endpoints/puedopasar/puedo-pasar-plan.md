# ¿Puedo Pasar? — Plan de Proyecto

> Documento de planificación técnica y de producto. Diseñado para ser consumido por Claude Code al momento de implementación. Divide el trabajo en **tres capas independientes**: **server**, **demon** y **client**.

---

## Índice

1. [Contexto y necesidad](#1-contexto-y-necesidad)
2. [Forma de pensar / decisiones](#2-forma-de-pensar--decisiones)
3. [Objetivo](#3-objetivo)
4. [Terminología legal — Instrucciones definitivas](#4-terminología-legal--instrucciones-definitivas)
5. [Zonas afectadas — Datos confirmados](#5-zonas-afectadas--datos-confirmados)
6. [Stack tecnológico](#6-stack-tecnológico)
7. [Arquitectura general](#7-arquitectura-general)
8. [Capa Server](#8-capa-server)
9. [Capa Demon](#9-capa-demon)
10. [Capa Client](#10-capa-client)
11. [i18n](#11-i18n)
12. [Fases de implementación](#12-fases-de-implementación)

---

## 1. Contexto y necesidad

Durante el torneo internacional de fútbol de verano 2026, la Ciudad de México implementa un operativo vial llamado **"Operativo Última Milla"** (también referido como "Polígono Última Milla" o "Primera Milla") alrededor del **Estadio Ciudad de México** (antes Estadio Azteca, actualmente también denominado Estadio Banorte) en los días de partido.

Este operativo implica:
- Un perímetro de seguridad de **~1.6 km** alrededor del estadio
- Cierres totales y parciales en vialidades clave del sur de CDMX
- Acceso restringido: solo con boleto, acreditación oficial, o código QR ("Tarjetón Digital") de residente emitido por la Alcaldía Coyoacán
- **Fechas confirmadas: 11, 17, 24, 30 de junio y 5 de julio de 2026**

No existe una herramienta centralizada, visual y accesible que permita a residentes, trabajadores, estudiantes y visitantes saber rápidamente si ese día hay cierre y si su ubicación se ve afectada.

---

## 2. Forma de pensar / decisiones

### Por qué una app efímera
El problema es temporal y muy específico. Una app ligera, sin base de datos compleja, desplegada en un subdominio existente (`puedopasar.hckr.mx`) es suficiente. No necesita auth, usuarios ni persistencia de estado del usuario.

### Por qué un agente de IA para los datos
Las fuentes oficiales (SSC CDMX, SEMOVI, Alcaldía Coyoacán) no tienen APIs. Publican en HTML y PDFs. Un agente puede monitorear cambios en fechas, perímetro u horarios sin intervención manual.

### Por qué 3 agentes separados
Inspirado en el patrón del proyecto Bookworms en el repo `dannegm/endpoints`. Cada agente tiene responsabilidad atómica: buscar, extraer, decidir. El orquestador es código puro que los llama en cadena, construye el JSON final y lo escribe al disco.

### Por qué datos estáticos en el cliente
El cliente importa un JSON estático — no hay fetch a ninguna API. El orquestador genera el archivo, el demon lo commitea al repo cliente, Vercel redeploya automáticamente. Resultado: cero latencia, cero costo de API en runtime, historial de cambios en git como auditoría gratuita.

### Por qué el demon como puente
El demon (`dannegm/demons`) ya existe, corre en la máquina local de Daniel, escucha ntfy y tiene acceso al filesystem. Es el puente natural entre el servidor remoto y el repo del cliente. No requiere infraestructura adicional.

### Por qué rate limit en memoria
App efímera, bajo tráfico. Un timestamp de última ejecución en memoria es suficiente.

---

## 3. Objetivo

Crear una utilidad web pública, visual y multilingüe que responda a la pregunta **"¿Puedo pasar hoy por la zona del Estadio Ciudad de México?"** con base en:

1. La fecha actual vs. los días de operativo (decidido por el agente, no hardcodeado)
2. La ubicación del usuario (geolocalización browser)
3. Datos actualizados cada 8 horas vía pipeline IA → demon → git

**Audiencia (en orden de prioridad):**
1. Residentes de la zona sur de CDMX
2. Personas que estudian, trabajan o transitan por la zona
3. Ciudadanos mexicanos (turismo local)
4. Turistas extranjeros

---

## 4. Terminología legal — Instrucciones definitivas

> ✅ **Research completado y verificado en fuente oficial.** Las siguientes instrucciones son definitivas y deben seguirse en todo el copy de la app, incluyendo textos UI, i18n, meta tags, OG tags, nombre del dominio y comentarios en código visible al usuario.
>
> Fuente primaria: FIFA Intellectual Property Guidelines, June 2024, version 2.0. Verificado el 11 de junio de 2026 directamente en `inside.fifa.com/tournament-organisation/brand-protection` — no existe versión más reciente. El mismo PDF sigue siendo el documento oficial vigente al inicio del torneo.

### Palabras y frases PROHIBIDAS (marcas registradas por FIFA)

No usar bajo ninguna circunstancia en copy de la app:

| Término | Nota |
|---|---|
| `FIFA` | Marca registrada global |
| `FIFA World Cup` / `FIFA World Cup 26` | Marca registrada |
| `World Cup` / `World Cup 26` / `WC26` | Marca registrada — incluso solas |
| `Copa Mundial de la FIFA` / `Copa Mundial de la FIFA 26` | Marca registrada en español |
| `COPA MUNDIAL` / `MUNDIAL` | Marcas registradas independientes |
| `Coupe du Monde de la FIFA` | Marca registrada en francés |
| `COUPE DU MONDE` | Marca registrada |
| Logo oficial del torneo | Protegido por copyright |
| Emblema oficial, mascota oficial | Protegidos |
| Tipografía oficial "FWC 26" | Protegida por diseño registrado |
| Slogans oficiales del torneo | Protegidos |
| Logos de ciudades sede | Protegidos (incluye "CDMX 2026" en formato oficial) |

**Importante:** FIFA también registró variaciones, abreviaciones y nombres fonéticamente similares. Ante la duda, no usar.

### Palabras y frases PERMITIDAS (copy seguro)

Estas expresiones son genéricas, descriptivas o de uso editorial legítimo:

| Término seguro | Uso sugerido |
|---|---|
| `evento deportivo` / `evento internacional` | Referencia al torneo sin nombrarlo |
| `torneo de fútbol` / `torneo internacional de fútbol` | Descripción genérica |
| `partido de fútbol` | Referencia a los juegos |
| `Estadio Ciudad de México` | Nombre oficial actual del recinto |
| `Estadio Banorte` | Nombre comercial actual del recinto |
| `Operativo Última Milla` | Nombre del operativo gubernamental — seguro |
| `Polígono Última Milla` | Nombre del perímetro — seguro |
| `SSC CDMX` / `Secretaría de Seguridad Ciudadana` | Fuente oficial |
| `Alcaldía Coyoacán` | Fuente oficial |
| `SEMOVI` | Fuente oficial |
| `cierre vial` / `restricción vehicular` | Descriptivo, seguro |
| `fútbol` / `soccer` | Deporte genérico, no marca |
| fechas específicas (11 jun, 17 jun...) | Hechos de dominio público |
| `días de partido` | Descriptivo sin asociación comercial |
| Banderas y colores nacionales | Permitidos sin escudos federación |

### Criterio de uso editorial (sección A3 de las guidelines)

La app califica como **uso editorial/descriptivo** porque:
- No tiene afiliación comercial con el torneo
- No genera revenue
- No usa Official IP en el nombre/dominio
- No crea impresión de que la app es patrocinada por FIFA
- Su propósito es informar sobre un operativo **gubernamental** (SSC CDMX), no sobre el torneo en sí

Las guidelines (sección A3) confirman: *"Editorial/descriptive use of the event is permissible as long as the use does not create a risk of confusion that the service is in any way connected with the Tournament or FIFA."*

### Nota sobre Clean Zones (fuente oficial: inside.fifa.com/tournament-organisation/brand-protection)

FIFA define las **Clean Zones** como perímetros alrededor de los estadios que restringen actividades comerciales no autorizadas. Importante para el copy de la sección "¿Cómo puedo pasar?":

> *"Permanent businesses and/or businesses regularly operating in a Clean Zone may, in principle, continue their usual core operations during the tournament period as long as their activity is not specifically targeting the event to obtain an undue promotional benefit."*

Esto significa que **negocios locales, trabajadores y residentes dentro del perímetro pueden continuar su actividad normal** — dato que debe reflejarse en la sección HowToPass del cliente.

La Clean Zone es una restricción comercial/publicitaria, no un bloqueo total de actividad civil. El operativo vial (Última Milla) es una medida separada implementada por la SSC CDMX.

### Reglas de implementación para Claude Code

1. **Nunca** usar ninguno de los términos prohibidos en: JSX, strings de i18n, meta tags, OG description, `<title>`, README, comentarios de código públicos
2. Al referirse al evento, usar: "el torneo", "el evento deportivo", "los partidos"
3. Al referirse al estadio, usar: "Estadio Ciudad de México" o "Estadio Banorte"
4. El nombre de la app `¿Puedo Pasar?` no contiene ningún término protegido ✅
5. El dominio `puedopasar.hckr.mx` no contiene ningún término protegido ✅
6. No incluir logos, emblemas ni la tipografía oficial del torneo en ningún asset

---

## 5. Zonas afectadas — Datos confirmados

> ✅ **Research completado.** Los datos siguientes están confirmados por fuentes oficiales (OVIAL/SSC CDMX, publicados el 9 de junio de 2026). Usar como base para `fallback.json` y `status.json` inicial.
>
> Fuentes: OVIAL_SSCCDMX (cuenta oficial), TV Azteca Noticias (fuente directa del tríptico oficial de OVIAL), Expansión Política, Grupo Animal.

### Fechas y horarios confirmados

| Fecha | Partido | Cierre parcial | Cierre total |
|---|---|---|---|
| **11 jun** | México vs Sudáfrica | 23:00h del día 10 | 05:00h |
| **17 jun** | Colombia vs Uzbekistán | 10:00h | 14:00h |
| **24 jun** | Chequia vs México | 09:00h | 13:00h |
| **30 jun** | Dieciseisavos de final | 09:00h | 13:00h |
| **5 jul** | Octavos de final | 08:00h | 12:00h |

> **Nota:** La reapertura de vialidades ocurre aproximadamente **3 horas después** de concluido cada partido.

### Vialidades con cierre TOTAL

Calles interiores del polígono, referenciadas en el tríptico oficial de OVIAL:

- San Gabriel – Santa Úrsula
- San Benjamín – Santa Úrsula
- San Cástulo – Santa Úrsula
- San Celso – Santa Úrsula
- San León – Santa Úrsula
- Santo Tomás – San Alejandro
- Santo Tomás – San Jorge
- San Guillermo – San Alejandro
- San Guillermo – San Jorge
- San Guillermo – Santa Úrsula

### Vialidades con cierre PARCIAL (intersecciones clave)

- Acoxpa y Las Torres
- Periférico y Circuito Azteca
- Periférico y Coscomate
- Periférico y Renato Leduc
- Periférico y Tlalpan
- Tlalpan y Viaducto Tlalpan
- Gran Sur e Imán

### Perímetro del polígono

- **Radio confirmado:** 1.6 km desde el centro del estadio
- **Centro del estadio (coordenadas):** `19.3029° N, 99.1505° W`
- **Zona de operación abarca:** Santa Úrsula, Calzada de Tlalpan, Acoxpa, Circuito Azteca, Periférico, Gran Sur, Avenida del Imán

### Instrucciones para Claude Code — generar `fallback.json`

Construir un GeoJSON aproximado del polígono usando las vialidades conocidas como bordes. Dado que el perímetro exacto no está publicado en formato digital/vectorial por las autoridades, usar el radio de 1.6km desde el centroide del estadio como aproximación inicial, con las vialidades como referencia de calibración.

Centroide: `{ "lat": 19.3029, "lng": -99.1505 }`

El agente (Agente 2 — Extractor) tiene instrucciones de buscar un mapa oficial más preciso en cada ciclo de refresh. Si lo encuentra, el Agente 3 lo prioriza sobre el polígono por radio.

### Acceso para residentes

Los residentes dentro del polígono deben tramitar el **Tarjetón Digital** en la Alcaldía Coyoacán. Las colonias que califican son las ubicadas dentro del polígono de la Última Milla.

---

## 6. Stack tecnológico

### Capa Server (`dannegm/endpoints`)
| Herramienta | Rol |
|---|---|
| Bun | Runtime |
| Express | HTTP server |
| OpenRouter (Gemini Flash) | LLM para los 3 agentes |
| GitHub Actions | Scheduler (cron cada 8h) |
| In-memory rate limit | Evitar ejecuciones excesivas |

> Vive en `src/endpoints/puedopasar/`. Expuesto en `endpoints.hckr.mx/puedopasar`.

### Capa Demon (`dannegm/demons`)
| Herramienta | Rol |
|---|---|
| Node.js + PM2 | Runtime daemon |
| ntfy.sh | Canal pub/sub para recibir comandos |
| TOTP (`OPT_KEY`) | Autenticación de comandos |
| git CLI | Commit + push al repo cliente |

> Corre localmente en la máquina de Daniel. Escucha el comando `updatePuedoPasar`.

### Capa Client (repo nuevo)
| Herramienta | Rol |
|---|---|
| Vite + React | Framework |
| Tailwind CSS | Estilos |
| Google Fonts | Tipografía |
| shadcn/ui | Componentes base |
| mapcn (MapLibre GL) | Mapa interactivo |
| TanStack Router | Routing |
| TanStack Query | Fetching / estado asíncrono |
| nuqs | Estado en URL (query params) |
| i18next + react-i18next | Internacionalización |
| Utilidades propias | Proporcionadas por Daniel antes de iniciar el código |
| Vercel | Deploy automático vía git push |

> Vive en su propio repo. Desplegado en `puedopasar.hckr.mx`.
> ⚠️ **Instrucción para Claude Code:** No iniciar el código del cliente hasta que Daniel proporcione las utilidades propias. Integrarlas antes de implementar cualquier componente.

### Idiomas
| Código | Idioma | Estado |
|---|---|---|
| `es` | Español | Original (Daniel) |
| `en` | Inglés | Original (Daniel + Luna) |
| `fr` | Francés | Traducción asistida por IA |
| `ja` | Japonés | Traducción asistida por IA (guiño) |

---

## 7. Arquitectura general

```
[GitHub Action — cron: 0 0,8,16 * * *]
        |
        v
[POST endpoints.hckr.mx/puedopasar/refresh]
  (Bearer token requerido)
        |
        v
[router.js — valida token + rate limit]
        |
        v
[orchestrator.js]
   1. Llama Agente 1 (Buscador)
   2. Pasa resultado a Agente 2 (Extractor)
   3. Pasa resultado a Agente 3 (Decisor)
   4. Construye programáticamente el JSON final
      (merge output del Agente 3 + perimeter.json)
   5. fs.writeFileSync → data/status.json
   6. Publica en ntfy: [otp]updatePuedoPasar({"dataUrl":"..."})
        |
        v
[GET /puedopasar/data] → sirve data/status.json
        |
        v
[Demon local — handler: updatePuedoPasar]
  1. fetch GET /puedopasar/data
  2. escribe en <CLIENT_REPO>/public/data/status.json
  3. git add + commit + push
        |
        v
[Vercel detecta push → redeploya]
        |
        v
[Cliente — import data from '/data/status.json']
```

---

## 8. Capa Server

> 🎯 **Instrucción para Claude Code — modo SERVER:**
> Trabajar exclusivamente en `src/endpoints/puedopasar/` dentro del repo `dannegm/endpoints`.
> No tocar otros endpoints, el cliente ni el demon.
> Runtime: Bun. Package manager: bun. No usar npm ni yarn.
> **Leer el `CLAUDE.md` del repo antes de escribir cualquier código** — contiene convenciones, arquitectura y restricciones específicas del proyecto que complementan este documento.
>
> ⚠️ **Nota sobre los bloques de código de esta sección:** Los snippets de código (endpoints, orquestador, agentes, state, GitHub Action) son **sugerencias lógicas**, no código final. Representan la intención y el flujo esperado, pero Daniel ajustará detalles de implementación antes o durante el desarrollo: nombre exacto de headers, generación de OTP, API de ntfy, estructura de funciones, etc. Revisar con Daniel antes de asumir que un detalle de implementación es definitivo.

### Estructura de archivos

```
src/endpoints/puedopasar/
├── router.js             # Express router: GET /data, POST /refresh
├── orchestrator.js       # Pipeline: 3 agentes → construye JSON → escribe → ntfy
├── agents/
│   ├── searcher.js       # Agente 1: búsqueda web
│   ├── extractor.js      # Agente 2: extracción de datos
│   └── decider.js        # Agente 3: decisión final
├── data/
│   ├── fallback.json     # Datos hardcodeados de respaldo (ver sección 5)
│   ├── perimeter.json    # GeoJSON del perímetro
│   └── status.json       # Generado por el orquestador, se sobreescribe en cada refresh
└── state.js              # Rate limit en memoria
```

### Endpoints expuestos

#### `GET /puedopasar/data`
Devuelve el contenido actual de `status.json`. Sin auth. Este es el único endpoint que consume el demon.

#### `POST /puedopasar/refresh`
Trigger del pipeline. Responde **inmediatamente** y ejecuta el orquestador en segundo plano (`runOrchestrator()` sin `await`). Esto evita 502s si los agentes tardan.

La validación del header y del rate limit es síncrona — si falla ahí, sí responde con error. Todo lo demás es async.

**Header de autenticación (valor proporcionado por Daniel):**
```
x-puedopasar-key: <PUEDOPASAR_SECRET>
```

**Response inmediata — pipeline iniciado:**
```json
{ "ok": true, "started": true }
```

**Response si rate limit activo:**
```json
{ "ok": true, "skipped": true, "lastChecked": "2026-06-11T08:00:00Z" }
```

### Schema de `status.json`

```json
{
  "today": true,
  "dates": [
    { "date": "2026-06-11", "partialClosure": "23:00", "totalClosure": "05:00", "prevDay": true },
    { "date": "2026-06-17", "partialClosure": "10:00", "totalClosure": "14:00" },
    { "date": "2026-06-24", "partialClosure": "09:00", "totalClosure": "13:00" },
    { "date": "2026-06-30", "partialClosure": "09:00", "totalClosure": "13:00" },
    { "date": "2026-07-05", "partialClosure": "08:00", "totalClosure": "12:00" }
  ],
  "affectedStreets": {
    "total": [
      "San Gabriel – Santa Úrsula",
      "San Benjamín – Santa Úrsula",
      "San Cástulo – Santa Úrsula",
      "San Celso – Santa Úrsula",
      "San León – Santa Úrsula",
      "Santo Tomás – San Alejandro",
      "Santo Tomás – San Jorge",
      "San Guillermo – San Alejandro",
      "San Guillermo – San Jorge",
      "San Guillermo – Santa Úrsula"
    ],
    "partial": [
      "Acoxpa y Las Torres",
      "Periférico y Circuito Azteca",
      "Periférico y Coscomate",
      "Periférico y Renato Leduc",
      "Periférico y Tlalpan",
      "Tlalpan y Viaducto Tlalpan",
      "Gran Sur e Imán"
    ]
  },
  "perimeter": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[...]]
    },
    "properties": {
      "radiusKm": 1.6,
      "center": { "lat": 19.3029, "lng": -99.1505 }
    }
  },
  "lastChecked": "2026-06-11T08:00:00Z",
  "source": "https://ssc.cdmx.gob.mx/...",
  "confidence": "high",
  "fallback": false
}
```

### Los 3 agentes

#### Agente 1 — Buscador (`searcher.js`)
- **Input:** ninguno
- **Output:** `[{ url, snippet, publishedAt }]` — máximo 5 resultados
- **Modelo:** Gemini Flash vía OpenRouter con web search habilitado
- **Regla estricta:** solo recolecta, no interpreta

**System prompt:**
```
Eres un agente de búsqueda especializado en operativos viales de la Ciudad de México.
Tu única tarea es encontrar información oficial y reciente sobre el Operativo Última Milla
alrededor del Estadio Ciudad de México.

Prioriza fuentes en este orden:
1. ssc.cdmx.gob.mx
2. semovi.cdmx.gob.mx
3. alcaldiacoyoacan.cdmx.gob.mx
4. Prensa nacional (reforma.com, expansion.mx, elfinanciero.com.mx)

Devuelve SOLO un array JSON. Sin explicaciones, sin markdown, sin texto adicional.
Formato exacto: [{ "url": "...", "snippet": "...", "publishedAt": "YYYY-MM-DD" }]
Máximo 5 resultados. Si no encuentras nada relevante, devuelve [].
```

#### Agente 2 — Extractor (`extractor.js`)
- **Input:** array de URLs del Agente 1 (el orquestador hace fetch del HTML y lo pasa como texto)
- **Output:** array de datos crudos extraídos
- **Regla estricta:** no toma decisiones, no infiere

**System prompt:**
```
Eres un agente extractor de datos sobre operativos viales en CDMX.
Recibirás el contenido de páginas web. Extrae ÚNICAMENTE:
- Fechas de operativo (formato YYYY-MM-DD)
- Hora de cierre parcial por fecha
- Hora de cierre total por fecha
- Nombres de calles afectadas con tipo (total/parcial)
- Radio del perímetro en km (si se menciona)

Devuelve SOLO un array JSON. Sin interpretación, sin conclusiones.
Si un dato no aparece en el texto, usa null.
Formato: [{
  "dates": [{ "date": "...", "partialClosure": "HH:MM", "totalClosure": "HH:MM" }],
  "streets": { "total": [...], "partial": [...] },
  "perimeterKm": null,
  "source": "URL"
}]
```

#### Agente 3 — Decisor (`decider.js`)
- **Input:** datos del Agente 2 + `fallback.json` + fecha actual inyectada como string
- **Output:** objeto parcial de status (sin `perimeter`, lo agrega el orquestador)
- **Regla:** si datos insuficientes → usar fallback, marcar `confidence: "low", fallback: true`

**System prompt:**
```
Eres un agente de decisión sobre operativos viales en la Ciudad de México.
Recibirás datos extraídos de fuentes web y datos de respaldo (fallback).

Produce el JSON final del estado del operativo.
La fecha actual es: [INJECT_DATE]

Reglas de confidence:
- "high": fuente principal es .gob.mx con datos recientes
- "medium": fuente principal es prensa nacional
- "low": solo datos de fallback disponibles

Si los datos web confirman los mismos datos que el fallback, igual marca "high" o "medium" según la fuente.
Si los datos web contradicen al fallback, prioriza los datos web y documenta en "source".

Devuelve SOLO este JSON. Sin explicaciones, sin markdown.
{
  "today": boolean,
  "dates": [{ "date": "YYYY-MM-DD", "partialClosure": "HH:MM", "totalClosure": "HH:MM" }],
  "affectedStreets": { "total": [...], "partial": [...] },
  "lastChecked": "ISO timestamp",
  "source": "URL principal",
  "confidence": "high|medium|low",
  "fallback": boolean
}
Nota: el campo "perimeter" lo agrega el orquestador desde perimeter.json. No lo incluyas.
```

### Orquestador (`orchestrator.js`)

Corre completamente en background. Usa ntfy para notificar progreso — estas notificaciones son **logs informativos**, no comandos (sin formato `[otp]comando`). Solo el mensaje final de éxito dispara el comando `updatePuedoPasar`.

```
export const runOrchestrator = async () => {
  ntfy("🚀 [puedopasar] Iniciando refresh de datos...")

  try {
    ntfy("🔍 [puedopasar] Agente 1: buscando fuentes oficiales...")
    const urls = await searcher()

    ntfy(`📄 [puedopasar] Agente 2: extrayendo datos de ${urls.length} fuentes...`)
    const extracted = await extractor(urls)

    ntfy("🧠 [puedopasar] Agente 3: tomando decisión final...")
    const decision = await decider(extracted, fallbackData, new Date().toISOString())

    const perimeter = JSON.parse(fs.readFileSync('data/perimeter.json'))
    const final = { ...decision, perimeter }

    fs.writeFileSync('data/status.json', JSON.stringify(final, null, 2))

    ntfy(`✅ [puedopasar] Datos actualizados. Confidence: ${final.confidence}. Fuente: ${final.source}`)

    // Comando para el demon — este sí tiene formato OTP
    ntfyCommand(`updatePuedoPasar({"dataUrl":"https://endpoints.hckr.mx/puedopasar/data"})`)

    state.lastRefresh = new Date().toISOString()
    state.lastResult = final

  } catch (err) {
    ntfy(`❌ [puedopasar] Error en el pipeline: ${err.message}`)
  }
}
```

**Dos funciones ntfy distintas:**
- `ntfy(msg)` — notificación simple de log, sin OTP, sin formato de comando
- `ntfyCommand(cmd)` — genera OTP y publica `[otp]cmd` para que el demon lo ejecute

### Rate limit en memoria (`state.js`)

```js
export const state = {
  lastRefresh: null,
  lastResult: null,
  REFRESH_INTERVAL: 8 * 60 * 60 * 1000, // 8 horas
};

export const canRefresh = () => {
  if (!state.lastRefresh) return true;
  return Date.now() - new Date(state.lastRefresh).getTime() > state.REFRESH_INTERVAL;
};
```

### Variables de entorno requeridas

```
PUEDOPASAR_SECRET=        # Bearer token para POST /refresh
OPENROUTER_API_KEY=       # Ya existe en el repo
NTFY_TOPIC=               # Ya existe en el repo (APP_TOPIC)
NTFY_OTP_KEY=             # Ya existe en el repo (OPT_KEY)
```

### GitHub Action

Archivo: `.github/workflows/puedopasar-refresh.yml`

```yaml
name: Puedo Pasar — Refresh
on:
  schedule:
    - cron: '0 0,8,16 * * *'
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger refresh
        run: |
          curl -X POST \
            -H "x-puedopasar-key: ${{ secrets.PUEDOPASAR_SECRET }}" \
            https://endpoints.hckr.mx/puedopasar/refresh
```

---

## 9. Capa Demon

> 🎯 **Instrucción para Claude Code — modo DEMON:**
> Trabajar exclusivamente en el repo `dannegm/demons`.
> Agregar un nuevo comando `updatePuedoPasar` siguiendo el patrón exacto de handlers existentes.
> No modificar otros demons ni commands.
> Package manager: yarn. Runtime: Node.js 24+.
> **Leer el `CLAUDE.md` del repo antes de escribir cualquier código** — contiene convenciones y arquitectura del proyecto que complementan este documento.
> Revisar `src/demons/bookworms/` como referencia de patrón existente antes de implementar.
>
> ⚠️ **Nota sobre los bloques de código de esta sección:** El código del handler es una **sugerencia lógica**, no código final. Daniel ajustará los detalles de implementación: API de ntfy, generación de OTP, estructura interna del handler, etc. Revisar con Daniel antes de asumir cualquier detalle como definitivo.

### Nuevo comando: `updatePuedoPasar`

**Formato del mensaje ntfy que dispara el comando:**
```
[123456]updatePuedoPasar({"dataUrl":"https://endpoints.hckr.mx/puedopasar/data"})
```

**Archivo:** `src/demons/puedopasar/index.js`

**Flujo del handler:**
1. Recibir `dataUrl` de los params JSON
2. `fetch(dataUrl)` → obtener el JSON de status
3. Asegurarse de que el path `<CLIENT_REPO_PATH>/public/data/` existe (crear si no)
4. Escribir el JSON en `<CLIENT_REPO_PATH>/public/data/status.json`
5. `git -C <CLIENT_REPO_PATH> add public/data/status.json`
6. `git -C <CLIENT_REPO_PATH> commit -m "chore: update status data [automated] $(date -u +%Y-%m-%dT%H:%M:%SZ)"`
7. `git -C <CLIENT_REPO_PATH> push`
8. Publicar notificación ntfy de éxito o error

**Variable de entorno nueva:**
```
PUEDOPASAR_CLIENT_REPO_PATH=/ruta/absoluta/al/repo/cliente
```

**Flag a agregar en `src/flags.js`:**
```js
'command.puedopasar': true,
```

**Registro en `src/demons/index.js`:**
```js
import { handler as updatePuedoPasar } from './puedopasar/index.js';
// agregar al objeto handlers existente
export const handlers = { ..., updatePuedoPasar };
```

---

## 10. Capa Client

> 🎯 **Instrucción para Claude Code — modo CLIENT:**
> Crear un repo nuevo con Vite + React + Tailwind + Google Fonts + shadcn/ui + mapcn + TanStack Router + TanStack Query + nuqs + i18next.
> **Este repo se crea desde cero. El `CLAUDE.md` y las reglas del proyecto serán definidas por Daniel en una ronda de contexto previa al inicio del desarrollo — esperarlas antes de escribir cualquier código.**
> **Esperar también las utilidades propias de Daniel antes de escribir cualquier componente.**
> Los datos vienen de `import data from '/data/status.json'` — no hay fetch a ninguna API.
> Seguir las instrucciones de terminología legal de la **sección 4** para todo el copy.
> No usar TypeScript. Usar `export const` para todas las declaraciones.
> Variables `useRef` con prefijo `$` sin sufijo `Ref`.

### Fuente de datos

```js
// En App.jsx o en un hook usePuedoPasar:
import statusData from '/data/status.json';
// statusData contiene: today, dates, affectedStreets, perimeter, lastChecked, source, confidence, fallback
```

### Estructura de la página (single page, scroll)

```
┌─────────────────────────────────────┐
│  HERO                               │
│  Pregunta: ¿Puedo pasar hoy?        │
│  Respuesta grande: SÍ / NO          │
│                                     │
│  Si no tiene geolocation:           │
│  CTA "Descubre si te afecta"        │
│  (solicita permiso al hacer click)  │
│                                     │
│  Si tiene geolocation:              │
│  Indicador color-coded de           │
│  proximidad al perímetro            │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  MAPA (card contenida, no fullpage) │
│  - Polígono del perímetro           │
│  - Punto azul: ubicación del user   │
│  - Si el user está fuera del        │
│    viewport del mapa: flecha en el  │
│    borde apuntando hacia el estadio │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  DÍAS DE CIERRE                     │
│  Lista (no calendario) con:         │
│  - Fecha (ej. "Miércoles 11 jun")   │
│  - Badge "HOY" si es el día actual  │
│  - Badge "PASADO" si ya fue         │
│  - Horario de cierre parcial/total  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ¿POR QUÉ CIERRAN?                  │
│  Qué es el Operativo Última Milla,  │
│  cómo funciona, fuentes oficiales   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ¿CÓMO PUEDO PASAR?                 │
│  Secciones por tipo de usuario:     │
│  - Tengo entrada al partido         │
│  - Soy residente (Tarjetón Digital) │
│  - Tengo que trabajar o estudiar    │
│  - Uso transporte público           │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  FOOTER                             │
│  "Datos actualizados: [timestamp]"  │
│  "Fuente: [source]"                 │
│  "Confianza: [confidence badge]"    │
│  Selector de idioma                 │
└─────────────────────────────────────┘
```

### Lógica de proximidad (color coding)

Calcular distancia en línea recta entre la ubicación del usuario y el centroide del perímetro (`19.3029, -99.1505`). Comparar contra el radio del polígono (`perimeterKm`).

| Situación | Color | Mensaje (es) |
|---|---|---|
| Dentro del perímetro | 🔴 Rojo | "Estás dentro de la zona de cierre" |
| < 500m del borde | 🟠 Naranja | "Estás muy cerca del perímetro" |
| 500m – 1.5km del borde | 🟡 Amarillo | "Estás cerca, puede afectarte" |
| > 1.5km del borde | 🟢 Verde | "Tu zona no se ve afectada directamente" |

### Componentes principales

```
src/
├── components/
│   ├── Hero.jsx              # Estado del día + geolocation CTA + ProximityIndicator
│   ├── MapCard.jsx           # Mapa mapcn/MapLibre con polígono y marker
│   ├── ClosureList.jsx       # Lista de fechas con badges
│   ├── WhyClosed.jsx         # Sección informativa del operativo
│   ├── HowToPass.jsx         # Guía por tipo de usuario
│   └── Footer.jsx            # Meta + language switcher
├── hooks/
│   ├── useGeolocation.js     # Solicita y devuelve coords del browser
│   └── useProximity.js       # Calcula distancia y nivel de afectación
├── lib/
│   └── geo.js                # haversine distance, punto en polígono
├── locales/
│   ├── es/translation.json
│   ├── en/translation.json
│   ├── fr/translation.json
│   └── ja/translation.json
└── App.jsx
public/
└── data/
    └── status.json           # Generado por el demon. NUNCA editar a mano.
```

---

## 11. i18n

### Setup
- `i18next` + `react-i18next`
- Detección automática del idioma del browser
- Fallback: `es`

### Idiomas
| Código | Idioma | Responsable |
|---|---|---|
| `es` | Español | Daniel (original) |
| `en` | Inglés | Daniel + Luna (original) |
| `fr` | Francés | Traducción asistida por IA |
| `ja` | Japonés | Traducción asistida por IA (guiño) |

### Flujo
1. `es` y `en` se escriben durante el desarrollo del cliente
2. Una vez estables, se generan `fr` y `ja` pasando los strings por Claude
3. Archivos en `src/locales/{lang}/translation.json`

### Recordatorio legal para copy
Todo texto en todos los idiomas debe seguir las instrucciones de la **sección 4**.
En particular: no traducir "World Cup" porque es marca registrada en inglés.
En francés: no usar "Coupe du Monde de la FIFA" ni "Coupe du Monde".
En japonés: no usar ninguna transliteración de los términos protegidos.

---

## 12. Fases de implementación

> Las fases 0 (research) están completadas y sus resultados están en las secciones 4 y 5.
> Se puede comenzar directamente con la Fase 1.

### Fase 1 — Server
- [ ] Generar `perimeter.json` con polígono GeoJSON (radio 1.6km desde `19.3029, -99.1505`)
- [ ] Generar `fallback.json` con los datos de la sección 5
- [ ] Scaffold `src/endpoints/puedopasar/` con la estructura definida
- [ ] Implementar `state.js`
- [ ] Implementar los 3 agentes (`searcher`, `extractor`, `decider`)
- [ ] Implementar `orchestrator.js`
- [ ] Implementar `router.js` con `GET /data` y `POST /refresh`
- [ ] Agregar GitHub Action `puedopasar-refresh.yml`
- [ ] Verificar: `GET /puedopasar/data` devuelve JSON válido con datos de fallback

### Fase 2 — Demon
- [ ] Revisar `src/demons/bookworms/` como referencia de patrón
- [ ] Crear `src/demons/puedopasar/index.js` con handler `updatePuedoPasar`
- [ ] Agregar `'command.puedopasar': true` en `src/flags.js`
- [ ] Registrar en `src/demons/index.js`
- [ ] Agregar `PUEDOPASAR_CLIENT_REPO_PATH` al `.env`
- [ ] Probar comando manualmente con OTP válido
- [ ] Verificar que el commit llega al repo cliente y Vercel redeploya

### Fase 3 — Client
- [ ] Crear repo con Vite + React + Tailwind + Google Fonts + shadcn + mapcn + TanStack Router + TanStack Query + nuqs + i18next
- [ ] **Recibir e integrar las utilidades propias de Daniel**
- [ ] Configurar i18next con `es` y `en`
- [ ] Crear `public/data/status.json` con datos de ejemplo para desarrollo local
- [ ] Implementar `useGeolocation`, `useProximity`, `geo.js`
- [ ] Implementar componentes en orden de la página
- [ ] Integrar mapa con polígono y marker de usuario
- [ ] Deploy en Vercel → `puedopasar.hckr.mx`

### Fase 4 — Traducciones y polish
- [ ] Generar `fr` y `ja` con ayuda de IA
- [ ] Auditar todo el copy contra sección 4
- [ ] Testing en mobile (audiencia principal usa teléfono)
- [ ] Verificar pipeline completo end-to-end: GitHub Action → agentes → demon → Vercel

---

*Documento generado durante sesión de planificación con Luna. Research legal y de zonas completado. Última actualización: junio 2026.*
