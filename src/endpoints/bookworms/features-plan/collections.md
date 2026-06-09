# Collections — Plan de Implementación

El objetivo es añadir un sistema de **colecciones curadas** de libros a Bookworms. Las colecciones representan un tema, mood o descubrimiento — una forma de que los lectores encuentren libros nuevos agrupados con intención editorial.

Las colecciones pueden crearse manualmente o generarse con IA. El flujo de IA encadena tres agentes que trabajan en pipeline: uno genera el contexto temático, otro amplifica la solicitud con aleatoriedad, y el tercero produce las recomendaciones. Un servicio independiente (no IA) valida que los libros sugeridos existan en el catálogo antes de guardar.

---

## Restricciones del catálogo

- Solo libros en español
- Catálogo fijo de +153k títulos
- Corte de contenido: **1 de enero de 2026** — títulos publicados después no están incluidos
- Las actualizaciones del catálogo son infrecuentes (pueden pasar años entre cortes)
- Las consultas sobre el catálogo completo pueden ser lentas — considerar optimizaciones de búsqueda

---

## Agentes

### Seeder — Agente de Topics

**Rol:** Seeding manual de topics. No forma parte del pipeline automático. Se invoca bajo demanda cuando se necesitan nuevas categorías en la tabla.

**Input:** Lista de topics ya existentes en la DB (para evitar repetición).

**Output:**
```json
[
    {
        "topic": "historias cortas de terror",
        "tags": ["lovecraft", "horror", "suspenso"],  // en español
        "hint": "Algo oscuro",
        "icon": { "library": "lucide-lab", "name": "skull" }
    },
    {
        "topic": "como el pasado imaginaba el futuro",
        "tags": ["asimov", "scifi", "espacio", "futuro"],
        "hint": "Otro mundo",
        "icon": { "library": "lucide", "name": "rocket" }
    }
]
```

- `hint`: frase de 2-3 palabras que captura el mood del topic. Ejemplos: *"Algo oscuro"*, *"Que enganche"*, *"Otro mundo"*, *"Para pensar"*, *"Clásicos"*, *"Ligero"*
- `icon`: objeto con la librería y el nombre del icono. Soporta dos librerías:
  - `lucide` — [lucide.dev/icons](https://lucide.dev/icons/) (iconos estables)
  - `lucide-lab` — [github.com/lucide-icons/lucide-lab](https://github.com/lucide-icons/lucide-lab) (iconos experimentales, `@lucide/lab`)

  Los nombres siguen convención kebab-case en ambas librerías.

El endpoint acepta un parámetro `count` en el body para controlar cuántos topics generar (default: 10).
Los topics generados se insertan directamente en la DB.

El output del agente se valida con **Zod** antes de insertar — si la estructura no es válida se descarta y se devuelve error.

> **Importante:** todos los tags deben estar en español.

---

### Prompter — Agente de Prompts

**Rol:** Toma un topic de la DB (seleccionado aleatoriamente con peso inverso a `times_used`) y lo amplifica con aleatoriedad para producir un prompt rico y variado. El objetivo es que cada colección sea fresca y no repita el sabor de colecciones anteriores.

**Input:**
```json
{
    "topic": "como el pasado imaginaba el futuro",
    "tags": ["asimov", "scifi", "espacio", "futuro"]
}
```
Además consulta un sample de ~20 colecciones recientes para evitar generar algo demasiado similar a lo ya existente. Si no hay colecciones aún, se indica en el prompt que puede sugerir libremente sin restricción de repetición.

**Output:** Texto libre con prompt enriquecido y tags adicionales.
> *Quiero descubrir libros que hablen sobre el futuro, imaginarios que aún no existen o que podrían existir, quiero realizar esos viajes al espacio que aún no son posibles y sorprenderme por lo que pueda encontrar #scifi #travel #space #exploration #future #distopic*

---

### Picker — Agente de Recomendaciones

**Rol:** Recibe un prompt en texto libre y devuelve una colección de libros recomendados con su contexto editorial.

**Input:** El prompt generado por Prompter, o el prompt manual del usuario.

**Output:**
```json
{
    "headline": "Viajes al futuro que el presente aún no puede hacer",
    "description": "Ciencia ficción que imaginó el mañana antes de que llegara. Asombro garantizado.",
    "tags": ["scifi", "futuro", "espacio", "clásicos", "distopia"],
    "books": [
        {
            "title": "Fundación",
            "authors": ["Isaac Asimov"],
            "published": 1951,
            "why": "La saga que definió la ciencia ficción moderna. Una civilización entera en una sola obra."
        }
    ]
}
```

- Debe sugerir **al menos 12 libros** (se esperan descartes en el matching, conviene tener margen)
- El campo `why` explica en máximo 120 caracteres por qué ese libro encaja en la colección
- Los tags siempre en español
- El sistema prompt debe instruirle que el catálogo es en español y con corte a enero 2026
- El output se valida con **Zod** antes de pasarlo al Matcher — si la estructura no es válida se devuelve error

---

### Matcher — Servicio de validación

**Rol:** No es un agente de IA. Es lógica de código pura que valida cada libro sugerido por Picker contra el catálogo local en memoria.

**Estrategia de búsqueda:** Al arrancar el servidor se carga un archivo `catalog-books.ndjson` en memoria y se construye un índice con **Fuse.js**. La búsqueda es local, sin consultas a la DB, en microsegundos.

> **Nota de escalabilidad:** Esta estrategia funciona bien hasta ~300k registros. Fuse.js es O(n) — escanea todo el índice en cada búsqueda. El Matcher puede hacer hasta 36 búsquedas por request (12 libros × 3 reintentos), así que la latencia escala linealmente con el tamaño del catálogo. Además, el índice en memoria ocupa ~0.6MB por cada 1,000 registros, lo que se vuelve presión real a partir de ~500k. Si en algún momento el catálogo supera los 300k registros y el Matcher empieza a ser el cuello de botella, las opciones son: (a) reemplazar Fuse.js por un índice binario pre-construido (e.g. FlexSearch con índice serializado), o (b) devolver la búsqueda a Supabase usando las funciones RPC de trigrams ya existentes (`search_books_similar`). En 2026, con 152,079 registros, esto no es un problema.

**Formato del catálogo (`catalog-books.ndjson`):**
Cada línea es un array compacto:
```
[libid, title, authors_csv, published, cover_id]
```
Ejemplo:
```
[23405,"Expreso de medianoche","Billy Hayes,William Hoffer",1977,23568]
[11203,"Frankenstein","Mary Shelley",1817,4421]
[11204,"Frankenstein","Mary Shelley",1831,4422]
```

- `authors_csv`: autores separados por coma, el más relevante primero
- El archivo lo genera un script externo a partir del JSON completo del catálogo (no es responsabilidad del endpoint)
- Al arrancar el servidor se parsean todas las líneas con `JSON.parse` y se construye el índice Fuse.js con objetos estructurados. El costo de startup (~153k JSON.parse sobre arrays pequeños) es < 100ms y permite usar field weights, que sería imposible buscando en strings raw.

**Campos de búsqueda en Fuse.js:** `title`, `authors`, `published` — en ese orden de peso. Incluir `published` permite distinguir entre ediciones del mismo título (e.g. Frankenstein 1817 vs 1831).

**Proceso por libro:**
1. Buscar en el índice Fuse.js con título + autor + año del libro sugerido por Picker
2. Tomar el primer resultado
3. Si el score supera `0.5` → descartar el libro (Fuse.js: 0 = match perfecto, 1 = sin match)

**Regla de umbral mínimo:** Si tras el matching quedan **3 libros o menos** (`< 4`), la sugerencia completa se descarta y se reintenta con otro topic. Máximo **3 intentos**. Si los 3 fallan → error 503.

**Output por libro validado:**
```json
{
    "libid": "123456",
    "cover_id": 89,
    "title": "Fundación",
    "authors": ["Isaac Asimov"],
    "published": 1951,
    "why": "La saga que definió la ciencia ficción moderna. Una civilización entera en una sola obra."
}
```

---

## Modelos de datos

### Tabla `topics`
```sql
CREATE TABLE bookworms.topics (
    id          SERIAL      PRIMARY KEY,
    topic       TEXT        NOT NULL,
    tags        TEXT[]      DEFAULT '{}',
    hint        TEXT,
    icon        JSONB,       -- { library: "lucide" | "lucide-lab", name: "kebab-case-name" }
    times_used  INT         DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla `collections`
```sql
CREATE TABLE bookworms.collections (
    id          SERIAL      PRIMARY KEY,
    headline    TEXT        NOT NULL,
    description TEXT,
    tags        TEXT[]      DEFAULT '{}',
    topic_id    INT         REFERENCES bookworms.topics(id),
    books       JSONB       DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

`books` es un array JSONB con la estructura del output de Matcher. La motivación (`why`) es específica por colección, por eso se embebe en lugar de usar una tabla junction.

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/topics` | Listado de topics paginado |
| `POST` | `/topics/generate` | Llama a Seeder para seedear nuevos topics en DB |
| `GET` | `/topic/:id/collections` | Colecciones vinculadas a un topic |
| `GET` | `/collections` | Listado de colecciones paginado |
| `GET` | `/collections/last` | Última colección guardada |
| `GET` | `/collections/:id` | Colección por ID |
| `POST` | `/collections` | Crear colección manualmente |
| `POST` | `/collections/suggest` | Pipeline IA completo → devuelve resultado **sin guardar** |
| `POST` | `/collections/generate` | Pipeline IA completo → guarda en DB |

### Sobre `suggest` y `generate`

Ambos ejecutan el mismo pipeline. La diferencia es que `generate` persiste el resultado.

**Body (ambos):**
```json
{
    "prompt": "una tarde melancólica #romance #desamor" // opcional
}
```

- Si viene `prompt` → se salta Prompter y va directo a Picker con ese prompt
- Si no viene `prompt` → se selecciona un topic de forma **aleatoria con peso inverso a `times_used`** (los menos usados tienen más probabilidad, pero no es determinista) → Prompter genera el prompt

Esto permite una UI de admin donde el usuario puede escribir su propio prompt, pedir a la IA que lo genere, revisar el resultado con `suggest`, y guardarlo con `generate` cuando esté conforme.

---

## Pipeline

```
POST /collections/generate  (o /suggest)
│
├─ ¿Viene `prompt` en el body?
│   ├─ Sí → ir directo a Picker con ese prompt
│   └─ No → seleccionar topic aleatorio con peso inverso a `times_used`
│            peso = 1 / (times_used + 1)
│            └─ Prompter: genera prompt enriquecido a partir del topic
│
├─ Picker: recibe prompt → sugiere ≥12 libros
│
├─ Matcher: valida cada libro contra la DB
│          - busca por título + autor + año
│          - elige el mejor match si hay duplicados
│          - descarta los que no se encuentran
│          - elimina duplicados por libid
│
├─ ¿Quedan 4 o más libros válidos? (es decir, > 3)
│   ├─ Sí → continuar
│   └─ No → reintentar con otro topic (máx 3 veces)
│            └─ Si los 3 intentos fallan → 503
│
└─ /generate → INSERT en collections + UPDATE topics.times_used
   /suggest  → devolver resultado sin persistir
```

---

## Tareas previas a la implementación

Estas tareas deben completarse antes de arrancar con el código del endpoint.

- [x] **Refactorizar `router.js`** — separar en sub-routers por responsabilidad para que el router principal solo monte módulos. Agrupaciones sugeridas:
  - `routes/search.js` — `/search`, `/search/:entity`, `/top`, `/summaries`
  - `routes/books.js` — `/book/:libid`, `/author/:authorKey`, `/serie/:serieKey`, `/category/:categoryKey`
  - `routes/files.js` — `/request`, `/validate`, `/download`, `/file`, `/sendto-kindle`, `/clear-bucket`
  - `routes/settings.js` — `/settings` (GET/PUT)
  - `routes/collections.js` — todo el scope de collections y topics (nuevo)

- [x] **Generar `catalog-books.ndjson`** — script que lee el JSON completo del catálogo y produce el archivo curado en formato `[libid, title, authors_csv, published, cover_id]` por línea.
  > El archivo generado pesa ~10MB con 152,079 registros — se commitea directamente al repo. En futuras actualizaciones del catálogo, verificar que el tamaño siga siendo razonable antes de commitear.
- [ ] **Crear las tablas en Supabase** — ejecutar el SQL de `topics` y `collections` en el proyecto de Supabase.
- [ ] **Seedear topics iniciales** — llamar a `POST /topics/generate` una vez desplegado para tener topics suficientes antes del primer `generate`. Sin topics en la DB, el pipeline no puede arrancar sin prompt manual.
- [ ] **Verificar variables de entorno** — el proyecto ya tiene `OPENROUTER_API_KEY` y `OPENROUTER_API_MODEL` configurados (actualmente apuntando a Gemini Flash Mini). Se reutilizan tal cual, sin vars nuevas.
- [ ] **Curar listas de iconos** — definir dos arrays de iconos relevantes para moods/géneros literarios (emociones, atmósferas, sensaciones) que se hardcodearán en el system prompt del Seeder:
  - `lucide`: extraer del catálogo estable los nombres más relevantes para el contexto de libros
  - `lucide-lab`: extraer la lista completa del directorio `icons/` del repo y filtrar manualmente los relevantes
  Una vez curadas, ambas listas van hardcodeadas en el system prompt del Seeder como vocabulario visual permitido.

- [ ] **Instalar dependencias** — `yarn add fuse.js` (para el Matcher). Zod ya está en el proyecto.

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `router.js` | Añadir los nuevos routes |
| `agents.js` | Seeder, Prompter, Picker (lógica de cada agente IA) |
| `matcher.js` | Matcher (validación contra DB, sin IA) |
| `db.sql` | Añadir tablas `topics` y `collections` |

## Variables de entorno

Se reutilizan las ya existentes en el proyecto:

```
OPENROUTER_API_KEY       # ya configurado
OPENROUTER_API_MODEL     # ya configurado, por defecto Gemini Flash Mini
```

---

## Retomar esta sesión

```bash
claude --resume 36bfb212-bd87-4ac9-a242-3ab435507f2d
```
