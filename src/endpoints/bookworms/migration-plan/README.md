# Bookworms — Migration Plan

Proceso para importar nuevos libros a la DB y mantener los `cover_id` actualizados.
Todos los scripts son CommonJS y se ejecutan directamente con Node **desde dentro de la carpeta `migration-plan/`**.

---

## Contexto del sistema de covers

Los covers se sirven desde un bucket de Supabase Storage como sprites WebP.
Cada sprite agrupa N covers en una cuadrícula. El `cover_id` es un índice secuencial
global que identifica la posición absoluta de un cover en el sistema de sprites.

**Grid actual: 4×3 (12 covers por sprite)**

```js
const spriteWidth = 4;
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

| Archivo                       | Origen              | Descripción                                                                   |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `bookinfo/bookinfo{Letra}.js` | Biblioteca original | Cover_id (clave) → [descripción, páginas, año, filename, bitmasks de géneros] |
| `indice.json`                 | Biblioteca original | Índice completo de libros con todos sus metadatos                             |

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
        "filename": "_Otros/Nombre-Autor.epub",
        "serie": "Nombre de la Serie",
        "serieseq": 1
    }
]
```

Los campos `serie` y `serieseq` son opcionales — los libros sin serie simplemente no los incluyen.
El campo `serieseq` puede ser entero o decimal (e.g. `0.5` para prelogs, `1.5` para novellas entre volúmenes).

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
Al primer arranque generan un archivo `.ndjson` con todos los registros pendientes
(e.g. `import-books-pending.ndjson`). Si el proceso se interrumpe (apagón, Ctrl+C, error),
al reiniciar retoman exactamente desde donde se quedaron — el registro fallido permanece
al inicio del archivo pendiente.

> NDJSON = Newline Delimited JSON. Cada línea es un objeto JSON independiente.
> El archivo se reescribe completamente después de cada registro procesado,
> por lo que el punto de reanudación es siempre exacto.

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

| Archivo                        | Descripción                                     |
| ------------------------------ | ----------------------------------------------- |
| `import-books-pending.ndjson`  | Libros pendientes de importar (import-books)    |
| `import-books-done.ndjson`     | Libros importados correctamente                 |
| `update-covers-pending.ndjson` | Covers pendientes de actualizar (update-covers) |
| `update-covers-done.ndjson`    | Covers actualizados correctamente               |

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
- Los autores y series se cachean en memoria durante `import-books.js` para minimizar consultas.
  Si se crean nuevos autores o series durante la sesión, el caché se actualiza en tiempo real.
- Los libros sin serie simplemente no incluyen `serie`/`serieseq` en `indice.json`.
  `import-books.js` maneja ambos casos: inserta en `series` y `series_books` si hay serie,
  y omite ese paso si no la hay.
- Si `build-new-books.js` reporta libros con `Missing cover: N`, es normal — significa que
  esos filenames no aparecen en los archivos `bookinfo/`. Se insertan con `cover_id = null`.
- Los archivos `.json` y `.ndjson` generados no se versionan (ver `.gitignore`).
  Solo se versionan los scripts.

---

## Trampas conocidas

**Supabase silently caps SELECT at 1000 rows**
El cliente de Supabase JS no devuelve error si hay más de 1000 filas — simplemente
corta el resultado sin avisar. Todos los fetch-\* scripts usan paginación explícita con
`.order('id').range(from, from + PAGE_SIZE - 1)` para evitar esto.
Si algún día se añade un nuevo script que lea de la DB, **siempre paginar**.

**Los cover_id no son derivables matemáticamente**
El offset entre cover_id viejo y nuevo no es uniforme — varía por libro porque se
insertaron ~23k libros nuevos distribuidos por toda la colección al regenerar los sprites.
Por eso existe `build-cover-updates.js`: genera el mapa completo desde los archivos fuente.

**El `cover_id` identifica posición global, no por sprite**
`cover_id = 50` está en el sprite `50 / 12 = 4` (sprite 4), posición `x = 50 % 4 = 2`,
`y = (50 / 4 | 0) % 3 = 0`. Si cambia el grid, hay que actualizar el cálculo en el cliente,
pero los cover_id en la DB no cambian (a menos que el orden de los covers también cambie).
