# Viabilidad: Migración a Bun

## Contexto

El servidor actualmente usa tsx como runtime JIT en producción. En un contenedor DO de 512MB el heap de Node.js queda limitado a ~256MB, y tsx consume suficiente memoria al compilar on-the-fly que el proceso muere durante el arranque ("Mounting server..." → OOM). El objetivo es evaluar si migrar a Bun resuelve el problema y si vale la pena frente a simplemente subir la RAM.

---

## Veredicto

**Técnicamente viable y recomendable a mediano plazo.** Pero hay trabajo no trivial. Para desbloquear el deploy hoy, subir a 1GB en DO es más rápido y sin riesgo.

---

## Lo que cambia con Bun

### ✅ Ventajas reales

| Factor | Situación actual | Con Bun |
|--------|-----------------|---------|
| Heap en arranque | ~200-250MB (tsx JIT) | ~20-50MB (transpiler built-in, sin overhead) |
| Path aliases `@/` | tsx lee jsconfig.json (manual con `--tsconfig`) | Bun lee tsconfig.json nativo, sin flags |
| Hot reload en dev | nodemon + tsx | `bun --watch` built-in |
| DO buildpack | Node.js (Heroku v342) | Bun buildpack v0.0.2 (lanzado dic 2025, sin Dockerfile) |
| `dotenv` | Necesario | Bun carga `.env` nativo, se puede quitar |
| `nodemon` | Necesario | Se puede quitar |
| `tsx` | Necesario | Se puede quitar |

### ⚠️ Trabajo requerido

**1. Lock file (obligatorio para que DO use el buildpack de Bun)**
- DO detecta Bun por la presencia de `bun.lock`
- Habría que abandonar `pnpm-lock.yaml` y pasar a `bun.lock`
- `bun install` migra automáticamente desde `pnpm-lock.yaml`
- Es un cambio unidireccional

**2. `__dirname` en src/**
- `src/loader.js:10` — `path.join(__dirname, './endpoints')`
- `src/endpoints/router.js:8` — `path.join(__dirname, '../..//home/dist')`
- `src/endpoints/bookworms/utils/icon-finder.js:5`
- Bun polyfill `__dirname` en modo CJS (probable que funcione sin cambios), pero si falla el fix es mínimo:
  ```js
  import { dirname } from 'path'
  import { fileURLToPath } from 'url'
  const __dirname = dirname(fileURLToPath(import.meta.url))
  ```

**3. jsconfig.json → tsconfig.json**
- Bun lee `tsconfig.json` nativamente para paths; `jsconfig.json` no está documentado como soportado
- Fix: crear `tsconfig.json` que extienda `jsconfig.json`, o mover la config directamente
- 1 archivo, cambio mínimo

**4. Scripts en package.json**
```json
"dev":   "bun --hot src/index.js",
"start": "NODE_ENV=production bun src/index.js",
"prod":  "NODE_ENV=production bun src/index.js"
```
Quitar: `tsx`, `nodemon`, `pm2` (opcional este último)

**5. Scripts de migración en bookworms/migration-plan/**
- Usan `require()` y `__dirname` estilo CJS
- Son scripts de un solo uso, no afectan al servidor
- Dejarlos o migrarlos cuando se necesiten

### 🟢 No requiere cambios

- Todas las dependencias core (express, supabase, redis, winston, etc.) — compatibles
- `re2`, `sharp`, `tiktoken` — ya aprobados en `.npmrc` y sólo son subdependencias nativas que Bun maneja
- `@openrouter/sdk`, `openai`, `resend`, `axios` — HTTP clients, sin issues

---

## Pasos de migración

1. Crear `tsconfig.json` extendiendo `jsconfig.json`
2. Verificar `__dirname` arranca sin errores con `bun src/index.js` (probablemente funciona por polyfill)
3. Correr `bun install` — migra `pnpm-lock.yaml` → `bun.lock` automáticamente
4. Eliminar `pnpm-lock.yaml`
5. Actualizar scripts en `package.json`
6. Quitar dependencias obsoletas: `tsx`, `nodemon` (y `pm2` si se quiere)
7. Actualizar `.npmrc` y `pnpm-workspace.yaml` — ya no aplican con bun
8. Test local: `bun --hot src/index.js`
9. Deploy a DO — el buildpack de Bun se activa por la presencia de `bun.lock`

---

## Comparativa: Bun vs subir RAM

| | Subir RAM (512MB → 1GB) | Migrar a Bun |
|---|---|---|
| Esfuerzo | 0 (clic en DO dashboard) | ~2-3 horas |
| Riesgo | Ninguno | Bajo-medio |
| Costo mensual | +$5-10/mes (estimado) | Sin cambio |
| Beneficio a largo plazo | Ninguno | Menor footprint, arranque más rápido, menos deps |

**Recomendación:** Subir RAM ahora para desbloquear el deploy. Migrar a Bun en una sesión dedicada cuando convenga.
