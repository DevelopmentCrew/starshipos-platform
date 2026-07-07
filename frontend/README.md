# StarshipOS frontend port

Plan for moving the real React app off Base44 onto our own API, without rewriting the ~250 screens.

## The idea

The app funnels all data access through one file, `src/api/base44Client.js`, which does `createClient()` from `@base44/sdk`, and every screen calls `base44.entities.X.filter/list/create/update`, `base44.auth.me()`, etc. So we swap that **one file** for `base44Client.js` in this folder, a drop-in that keeps the same interface but calls the StarshipOS API (`/api/*`) and Cognito. Screens keep working unchanged.

## What the compat client covers

- `base44.entities.<Entity>.list/filter/get/create/update/delete/bulkCreate` → `/api/<snake_table>` (with the API's field filters + RLS).
- `base44.auth.me()` → `/api/me`; `auth.login({email,password})` → Cognito SRP; `auth.logout()`, `auth.getToken()`.
- `base44.integrations.*` and `base44.functions.*` → throw "not ported yet" so we can see exactly which backend logic each screen needs.

## Assembly steps (next)

1. **Get the source into a new repo.** The full React source lives in the Base44-synced repo `DevelopmentCrew/StarshipOS2`. Clone it and copy its contents into a new, independent repo (e.g. `starshipos-frontend`) — *do not* keep it wired to Base44's sync.
2. **Swap the client.** Replace `src/api/base44Client.js` with this folder's `base44Client.js`; `npm i amazon-cognito-identity-js`.
3. **Adapt the sign-in screen** (`src/pages/StarshipSignIn.jsx`) to call `base44.auth.login()` (Cognito) instead of Base44's login.
4. **Env + build.** Set `VITE_API_BASE=/api`, `VITE_COGNITO_POOL`, `VITE_COGNITO_CLIENT`; `npm run build` (Vite).
5. **Deploy.** A frontend CI workflow: build → `aws s3 sync dist/ s3://starshipos-dev-frontend` → CloudFront invalidation. (CloudFront already serves `/` from that bucket and proxies `/api/*` to the API.)
6. **Port backend functions module-by-module.** Each `base44/functions/*` and integration (Xero, InvokeLLM/AI, SharePoint, file storage) becomes an API endpoint. Screens light up as their dependencies land; the "not ported yet" errors tell us the order.

## Reality check

The data/CRUD layer comes across cheaply via the shim. The weight is the 40+ backend functions and the integrations (Xero, AI, Graph, storage) — that's the module-by-module part, and it's where most of the remaining effort is.
