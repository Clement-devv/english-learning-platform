# English Learning Platform

A multi-tenant SaaS platform for English language learning centers. Each center gets a dedicated database, subdomain, customizable landing page, and admin panel. A single super admin manages all centers from a central dashboard.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Socket.IO client |
| Backend | Node.js 20, Express, Mongoose 8 |
| Database | MongoDB — one master DB + one DB per center |
| Real-time | Socket.IO (whiteboard, live classroom) |
| Infrastructure | Docker, Caddy (reverse proxy + auto HTTPS), Redis |

## Running Locally

**Prerequisites:** Node 20+, MongoDB running locally or a Atlas URI.

**Backend**
```bash
cd server
cp .env.example .env      # fill in the values
npm install
node index.js
```

**Frontend**
```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in all required values.
Required: `MONGO_URI`, `MASTER_DB_URI`, `DB_BASE_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `EMAIL_USER`, `EMAIL_PASSWORD`.

## Deployment

Full server setup, Docker commands, and troubleshooting: [docs/deployment.md](docs/deployment.md)

## Architecture

Multi-tenant database design and routing rules: [docs/multi-tenant.md](docs/multi-tenant.md)
