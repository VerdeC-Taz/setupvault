# SetupVault

A personal library for installers, config files, scripts and docs. Upload files to private Cloudflare R2 storage, organize them with categories and tags, and share them by link.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma + Neon Postgres · Cloudflare R2 · JWT sessions (jose + bcrypt)

## Demo mode

If `DATABASE_URL` or the R2 variables are missing, the app runs in **demo mode**: data lives in memory and files are written to a temporary local folder. Sign in with `demo@setupvault.dev` / `demo12345`. Everything resets when the server restarts.

## Setup

1. **Install**

   ```bash
   pnpm install
   cp .env.example .env
   ```

2. **Neon:** create a project at [neon.tech](https://neon.tech) and copy the pooled connection string into `DATABASE_URL`.

3. **Session secret:** `openssl rand -base64 32` → `NEXTAUTH_SECRET`.

4. **Cloudflare R2**
   - Create a bucket (keep it private).
   - Create an R2 API token with *Object Read & Write* for that bucket and copy the access key ID and secret.
   - Your account ID is shown on the R2 overview page.
   - Add a CORS policy so browsers can upload directly with presigned URLs:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

5. **Database**

   ```bash
   pnpm db:push    # create tables
   pnpm db:seed    # optional: demo user + sample setups
   pnpm dev
   ```

## How it works

- **Uploads:** the client calls `POST /api/setups`, which validates metadata, type (`.exe .dmg .msi .zip .tar.gz .sh .ps1 .json .yaml .md .pdf`) and size (500 MB max), creates the record and returns a presigned PUT URL that expires in 10 minutes. The browser uploads straight to R2 with progress. If the upload fails, the record is deleted.
- **Downloads:** `GET /api/setups/:id/download` is rate-limited (10/min per IP), logs a hashed IP, increments the counter and returns a 5-minute presigned GET URL.
- **Sharing:** `/setup/:id` is public. The unguessable ID is the share capability; only the owner sees edit and delete.
- **Auth:** email + password with bcrypt hashing and an HttpOnly, signed JWT cookie. Every setup query is scoped to the session user ID.

## Deploy to Vercel

1. Push to GitHub and import the repo into Vercel.
2. Add the environment variables from `.env.example`.
3. Set the build command to `prisma generate && next build` (or run `pnpm db:push` against production once).
4. Add your production domain to the R2 CORS `AllowedOrigins`.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Generate the Prisma client and build |
| `pnpm db:push` | Sync the Prisma schema to the database |
| `pnpm db:seed` | Seed the demo user and sample setups |
