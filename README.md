# Anchor — a git-native API client (full stack)

Monorepo: `frontend/` (React + Vite, what you already had) and `backend/` (Express + MongoDB via Prisma, new).

## Architecture, and why

- **Accounts + cloud sync**: collections and environments now live in MongoDB, tied to
  a user account (JWT in an httpOnly cookie). Multi-device sync works because the
  backend is the source of truth, not a local file.
- **Server-side proxy** (`/api/proxy`): the browser never calls third-party APIs
  directly anymore. It calls your backend, which makes the real request server-side
  and returns the result. This is what actually fixes CORS — browser `fetch()` is
  blocked by CORS for most APIs; a Node server making the same request is not.
- **Export snapshot**: since the backend is now the source of truth, the old
  "connect a local folder and live-sync files" feature is gone — that model doesn't
  make sense with multi-device cloud sync. Instead there's an explicit
  "Export snapshot (.json)" button so you can still drop your collections into a git
  repo and diff them; it's a manual export, not continuous sync.

## What's genuinely untested

I could not run `prisma generate` in my build sandbox (its engine binaries are on a
domain my network allowlist blocks), so the backend's TypeScript passed only against
an untyped Prisma stub, not real generated types. **Run `npx prisma generate` and then
`npx tsc --noEmit` yourself in `backend/` before trusting it** — that's step 1 below.
The frontend, by contrast, is fully build-verified.

## Prerequisites

- Node.js 20+
- Docker (for local MongoDB), or a MongoDB Atlas connection string

## 1. Start MongoDB locally

MongoDB transactions (used when activating an environment) require a replica set,
even for a single local node — a bare `mongod` will throw at runtime. The provided
`docker-compose.yml` handles this:

```bash
docker compose up -d
```

This starts Mongo on `localhost:27017` as a single-node replica set (`rs0`).

If you'd rather use MongoDB Atlas (free tier): create a cluster, get its connection
string, and use that as `DATABASE_URL` instead — Atlas clusters are already replica
sets, so no extra setup needed there.

## 2. Backend setup

```bash
cd backend
cp .env.example .env
# edit .env: set a real JWT_SECRET (e.g. `openssl rand -base64 32`)
npm install
npx prisma generate   # downloads Prisma's query engine — needs real internet access
npx prisma db push    # creates collections/indexes in MongoDB from schema.prisma
npx tsc --noEmit      # verify — I could not do this step myself, see note above
npm run dev           # starts on http://localhost:4000
```

## 3. Frontend setup

```bash
cd frontend
cp .env.example .env   # VITE_API_URL should point at the backend, default is fine locally
npm install
npm run dev             # starts on http://localhost:5173
```

Open `http://localhost:5173`, create an account, and you're in.

## 4. Deploying

**Backend** — needs a real Node server (not a static host): Railway or Render both
work well.
- Set `DATABASE_URL` (MongoDB Atlas connection string — Atlas's free tier is enough
  to start), `JWT_SECRET`, `CLIENT_ORIGIN` (your deployed frontend URL, exactly,
  including https://), `NODE_ENV=production`.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Run `npx prisma db push` once against your production `DATABASE_URL` before first boot.

**Frontend** — static, deploys to Vercel/Netlify same as before.
- Set `VITE_API_URL` to your deployed backend's URL.
- `vercel.json` already has the SPA rewrite.

Deploy the backend first, then point the frontend's `VITE_API_URL` at it, then deploy
the frontend — that order matters, since the frontend build bakes `VITE_API_URL` in
at build time, not runtime.

## Real gaps against Postman, unchanged from before

No test/pre-request scripts, no mock servers, no WebSocket/gRPC, no team workspaces
(this is single-user accounts, not shared workspaces — that's a genuinely different
data model, not a small addition). Form-data body mode now sends
`application/x-www-form-urlencoded` through the proxy rather than real multipart —
so file uploads in request bodies aren't supported. Flagging it now rather than
letting you discover it.

## Tech

Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, Lucide.
Backend: Express, TypeScript, Prisma (MongoDB), JWT auth (httpOnly cookies), Zod validation, bcrypt.
