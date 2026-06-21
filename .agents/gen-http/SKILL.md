---
name: gen-http
description: "Generate or update an api.http file documenting all routes for a given endpoint folder. Pass the endpoint name as args (e.g. /gen-http bookworms)."
trigger: /gen-http
---

# /gen-http

Generate or update `src/endpoints/<name>/api.http` with all HTTP routes defined in that endpoint.

## Steps

### 1. Resolve the endpoint name

Get it from `args`. If missing, ask the user.

### 2. Read and trace all source files

Start with `src/endpoints/<name>/router.js`. Then:

- Follow every `import` and `require` to read each referenced file — route files, local middleware files, utility files, anything inside the endpoint folder.
- Also read every shared file used: anything imported from `src/helpers/`, `src/services/`, etc. that is referenced by a middleware call on a route.
- Do not stop at one level — keep tracing imports until you have read every file that contributes middleware or route logic to this endpoint.

### 3. Derive headers per route from the actual middleware code

**Do not assume any header name or auth mechanism.** For every middleware applied to a route (either at the router level or inline on the route), read its implementation and determine:

- What headers does it read from `req.headers`?
- What is the exact header key (e.g. `req.headers['x-dnn-apikey']`, `req.headers['authorization']`, `req.headers['x-token']`)?
- Is the header name hardcoded or passed as a parameter? If a parameter, trace the call site in router.js to find the actual value passed.

Build a per-route map of required headers. Routes with no auth middleware get no auth header in the `.http` file. Routes with different middleware get different headers.

If a route file uses a middleware you cannot find the source for (e.g. a third-party package), note it as `# middleware: <name> (external)` in a comment above the request.

### 4. Identify all env vars used

Scan all read files for `process.env.` references. These become `@variable = {{$dotenv VAR_NAME}}` entries in the variables block.

### 5. Generate the `api.http` file

Follow the REST Client standard:

- Variables block at the top: `@base` (using the endpoint's mount path from `src/loader.js` or the folder name), then all `@variable = {{$dotenv VAR_NAME}}` entries, then placeholder variables for path params (e.g. `@id = 1`, `@slug = example`)
- Group requests with `# ──── SECTION ────` comment headers matching the route files or logical groupings
- `###` (triple hash) separates each request — this is the REST Client delimiter
- Each request: method + URL, then headers immediately below (no blank line), then one blank line + JSON body for POST/PUT/PATCH
- Descriptive `### Description` line above each request

### 6. Write the file

Write to `src/endpoints/<name>/api.http`. Replace any existing file entirely.

### 7. Confirm

Tell the user: how many routes were documented, what headers were found, and the output path.

## Format reference

```http
@base = https://endpoints.hckr.mx/name
@apiKey = {{$dotenv NAME__APP_KEY}}
@id = 1

# ──── SECTION ────

### Description of what this does
GET {{base}}/resource/{{id}}
x-dnn-apikey: {{apiKey}}

### Create resource
POST {{base}}/resource
x-dnn-apikey: {{apiKey}}
Content-Type: application/json

{
  "field": "value"
}
```

## Rules

- Never invent routes — only document what is actually defined in the code
- Never assume a header name — always read the middleware source
- If a route has query params, include them as `?param=value` in the example URL
- For paginated routes, always include `?page=1&limit=10`
- If a route uses a format param (e.g. `:format(svg|png)`), show each variant as a separate request
- Do not add routes from sibling endpoints
- Keep the order of sections consistent with how the router mounts them
