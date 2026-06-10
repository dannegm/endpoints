# Bookworms — Collections API

Base URL: `https://endpoints.hckr.mx/bookworms`

All requests require the header:
```
x-dnn-apikey: <BOOKWORMS_APP_KEY>
```

---

## Pagination

List endpoints accept `?page=1&limit=10`. Default limit is 10. Returns `[]` when there are no results.

---

## Data shapes

### Topic
```json
{
  "id": 1,
  "topic": "Libros que te hacen cuestionar todo",
  "tags": ["filosofía", "existencialismo", "ensayo"],
  "hint": "Para pensar",
  "icon": { "library": "lucide", "name": "brain" },
  "times_used": 3,
  "created_at": "2026-06-09T12:00:00Z"
}
```

### Collection
```json
{
  "id": 7,
  "headline": "El peso de las ideas",
  "description": "Libros que no te sueltan ni cuando los cierras.",
  "tags": ["filosofía", "ensayo"],
  "topic_id": 1,
  "books": [...],
  "created_at": "2026-06-09T12:00:00Z"
}
```

### Book (dentro de `books[]`)
```json
{
  "libid": 482931,
  "cover_id": 8821043,
  "title": "El mundo de Sofía",
  "authors": ["Jostein Gaarder"],
  "published": 1991,
  "score": 0.0412,
  "bonus": 5,
  "why": "Una novela que enseña historia de la filosofía sin que lo parezca."
}
```

| Campo | Descripción |
|-------|-------------|
| `libid` | ID del libro en la biblioteca — usar para enlazar o descargar |
| `cover_id` | ID de portada del libro |
| `score` | Score de fuzzy match (0 = perfecto). Solo informativo |
| `bonus` | Puntos de confianza del match (más alto = más seguro). Solo informativo |
| `why` | Frase corta generada por la IA explicando por qué encaja en la colección |

---

## Endpoints

### Topics

#### `GET /topics`
Lista de topics paginada.

```
GET /topics?page=1&limit=10
```

**Response `200`**
```json
[
  { "id": 1, "topic": "...", "tags": [], "hint": "...", "icon": {...}, "times_used": 0, "created_at": "..." }
]
```

---

#### `POST /topics/generate`
Genera nuevos topics vía IA y los persiste. Evita duplicar los ya existentes.

```json
{ "count": 10 }
```
`count` es opcional, default `10`.

**Response `200`** — array de topics insertados (mismo shape que `GET /topics`).

---

### Collections

#### `GET /collections`
Lista de colecciones paginada, ordenada por más reciente.

```
GET /collections?page=1&limit=10
```

**Response `200`**
```json
[
  { "id": 7, "headline": "...", "description": "...", "tags": [], "topic_id": 1, "books": [...], "created_at": "..." }
]
```

---

#### `GET /collections/last`
Devuelve la colección más reciente. Útil como "colección de la semana".

**Response `200`** — objeto Collection.
**Response `404`** — `{ "error": "No hay colecciones." }` si la tabla está vacía.

---

#### `GET /collections/:id`
Devuelve una colección por ID.

**Response `200`** — objeto Collection.
**Response `404`** — `{ "error": "Colección no encontrada." }`

---

#### `GET /topic/:id/collections`
Lista colecciones asociadas a un topic, paginada.

```
GET /topic/1/collections?page=1&limit=10
```

**Response `200`** — array de Collections.

---

#### `POST /collections/suggest`
Genera una colección con el pipeline de IA pero **no la guarda**. Útil para preview.

**Body** (opcional):
```json
{ "prompt": "libros de terror psicológico" }
```
Si no se manda `prompt`, el pipeline selecciona un topic automáticamente.

**Response `200`**
```json
{
  "headline": "...",
  "description": "...",
  "tags": ["terror", "psicología"],
  "topic_id": 3,
  "books": [...]
}
```

**Response `503`** — no hay topics disponibles o no se encontraron libros suficientes.

---

#### `POST /collections/generate`
Dispara el pipeline completo y **persiste la colección**. Responde inmediatamente con `202` y corre en background. Al terminar envía una notificación push.

**Body** (opcional):
```json
{ "prompt": "libros de terror psicológico" }
```

**Response `202`**
```json
{ "message": "Pipeline iniciado." }
```

El resultado final llega vía notificación push (ntfy). No hay polling — si necesitas el resultado, consulta `GET /collections/last` unos minutos después.

---

#### `POST /collections`
Crea una colección manualmente, sin IA.

```json
{
  "headline": "Mi colección manual",
  "description": "Descripción opcional",
  "tags": ["tag1"],
  "topic_id": 1,
  "books": []
}
```
`headline` es requerido. El resto es opcional.

**Response `201`** — objeto Collection creado.

---
