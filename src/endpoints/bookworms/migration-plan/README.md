# Bookworms — Migration Plan

Proceso para importar nuevos libros a la DB y mantener los `cover_id` actualizados.
Todos los scripts son CommonJS y se ejecutan directamente con Node desde la raíz del proyecto.

---

## Contexto del sistema de covers

Los covers se sirven desde un bucket de Supabase Storage como sprites WebP.
Cada sprite agrupa N covers en una cuadrícula. El `cover_id` es un índice secuencial
global que identifica la posición absoluta de un cover en el sistema de sprites.

**Grid actual: 4×3 (12 covers por sprite)**

```js
const spriteWidth  = 4;
const spriteHeight = 3;

// Qué archivo de sprite usar
const imageNumber = (cover_id / (spriteWidth * spriteHeight)) | 0;
// → img/{imageNumber}.webp

// Posición dentro del sprite
const imageX = cover_id % spriteWidth;
const imageY = ((cover_id / spriteWidth) | 0) % spriteHeight;
```

> Si el grid cambia en el futuro, solo cambia `spriteWidth` y `spriteHeight` en el cliente.
> Los `cover_id` en la DB no necesitan cambiar mientras el orden secuencial de los covers
> se conserve en la regeneración de sprites.
> Si el orden cambia, sí hay que regenerar los `cover_id` con un bulk update
> (ver sección "Actualizar cover_id").

---

## Fuentes de datos

| Archivo | Origen | Descripción |
|---|---|---|
| `bookinfo/bookinfo{Letra}.js` | Biblioteca original | Cover_id (clave) → [descripción, páginas, año, filename, bitmasks de géneros] |
| `indice.json` | Biblioteca original | Índice completo de libros con todos sus metadatos |

### Estructura de `bookinfo{Letra}.js`

```js
var binfo = {
    <cover_id>: [
        "descripción del libro",  // [0]
        385,                      // [1] pagecount
        2017,                     // [2] published year
        "_Otros/Nombre-Autor",    // [3] filename sin .epub — join key con la DB
        32,                       // [4] subjects bitmask (bits 0–31)
        32,                       // [5] subjects bitmask (bits 32–63)
        1024,                     // [6] subjects bitmask (bits 64–95)
    ]
}
```

La clave del objeto ES el `cover_id`. El filename en `[3]` es el campo que une
esta fuente con `indice.json` y con la columna `filename` de la DB (añadiendo `.epub`).

### Estructura de `indice.json`

```json
[
  {
    "libid": 40022726,
    "title": "Nombre del libro",
    "authors": ["Autor Uno", "Autor Dos"],
    "description": "...",
    "labels": ["Novela", "Romántico"],
    "published": 2018,
    "pagecount": 314,
    "sha256sum": "abc123...",
    "size": 1234567,
    "filename": "_Otros/Nombre-Autor.epub"
  }
]
```

---

## Scripts disponibles

```
migration-plan/
├── build-cover-map.js      — Lee bookinfo/ y genera los mapas de cover_id
├── fetch-libids.js         — Descarga todos los libids existentes de la DB
├── fetch-authors.js        — Descarga todos los autores existentes de la DB
├── fetch-series.js         — Descarga todas las series existentes de la DB
├── build-new-books.js      — Filtra libros nuevos e inyecta cover_id
├── build-cover-updates.js  — Genera el mapa de actualizaciones de cover_id
├── import-books.js         — Importa libros nuevos a la DB
└── update-covers.js        — Actualiza cover_id de libros existentes
```

---

## Proceso completo paso a paso

### Fase 1 — Curado de datos

Navegar a la carpeta primero:

```bash
cd src/endpoints/bookworms/migration-plan
```

Luego ejecutar cada script con `node`:

```bash
# 1. Construir mapa de covers a partir de los archivos binfo
node build-cover-map.js
# → genera: filename_to_cover.json, cover_to_filename.json

# 2. Descargar snapshot de la DB
node fetch-libids.js
# → genera: existing-libids.json

node fetch-authors.js
# → genera: existing-authors.json

node fetch-series.js
# → genera: existing-series.json

# 3. Generar listado de libros nuevos (filtra existentes + inyecta cover_id)
node build-new-books.js
# → genera: new-books.json
# → log: cuántos son nuevos y cuántos ya estaban

# 4. Generar listado de cover_id a actualizar para libros existentes
node build-cover-updates.js
# → genera: cover-updates.json
```

Los pasos 3 y 4 se pueden ejecutar en paralelo ya que comparten las mismas entradas.

### Fase 2 — Migración

```bash
# Importar libros nuevos (se puede parar y retomar)
node import-books.js

# Actualizar cover_id de libros existentes (se puede parar y retomar)
node update-covers.js
```

Ambos scripts se pueden correr en paralelo entre sí.

---

## Comportamiento de los scripts de migración

**Reanudación automática**
Al primer arranque generan un archivo `import-books-pending.ndjson` con todos los registros pendientes.
Si el proceso se interrumpe (apagón, Ctrl+C, error), al reiniciar retoman exactamente
desde donde se quedaron — el libro fallido permanece al inicio del archivo pendiente.

**Reintentos**
Cada registro se reintenta hasta 3 veces con backoff exponencial (2s, 4s, 6s).
En cada intento fallido se loguea la razón clasificada:
- Rate limit (HTTP 429)
- Error de red / timeout
- Violación de constraint en la DB
- Campos nulos requeridos

**Parada en fallo permanente**
Si un registro agota los 3 reintentos, el script se detiene con `exit(1)` y muestra
el motivo. Al corregir el problema y reiniciar, retoma desde ese mismo registro.

**Archivos de estado generados en runtime**

| Archivo | Descripción |
|---|---|
| `import-books-pending.ndjson` | Libros pendientes de importar (import-books) |
| `import-books-done.ndjson` | Libros importados correctamente |
| `covers-import-books-pending.ndjson` | Covers pendientes de actualizar (update-covers) |
| `covers-import-books-done.ndjson` | Covers actualizados correctamente |

---

## Actualizar cover_id en el futuro

Si se regeneran los sprites con un nuevo orden de covers:

1. Verificar si el grid cambió (`spriteWidth` / `spriteHeight`)
   - Si solo cambió el grid pero el orden de covers es el mismo → solo actualizar el cliente
   - Si el orden de covers cambió → hay que regenerar los `cover_id` en la DB

2. Si hay que regenerar:
   ```bash
   node build-cover-map.js       # nuevo mapa desde los binfo actualizados
   node fetch-libids.js           # snapshot actual de la DB
   node build-cover-updates.js    # genera cover-updates.json
   node update-covers.js          # aplica el bulk update
   ```

---

## Notas importantes

- Los scripts usan `libid` como identificador único del libro (no `id` interno de la DB).
- Los autores se cachean en memoria durante `import-books.js` para minimizar consultas.
  Si se añaden muchos autores nuevos en una sola sesión, el caché se actualiza en tiempo real.
- Las series vienen en `indice.json` como `serie` y `serieseq`. Los libros sin serie
  simplemente no incluyen esos campos. `import-books.js` maneja ambos casos: inserta
  en `series` y `series_books` si el libro tiene serie, y omite ese paso si no la tiene.
- Los archivos `.json` generados no se versionan (ver `.gitignore`). Solo se versionan
  los scripts.
