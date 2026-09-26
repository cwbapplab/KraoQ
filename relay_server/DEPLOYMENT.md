# KraoQ Relay Server Deployment Guide

This guide covers how to deploy and configure the KraoQ Relay Server using Docker or Node.js.

## 📋 Prerequisites

- **Docker & Docker Compose** (Recommended)
- **Node.js 18+** (For local development)
- **PostgreSQL 15+** (If not using Docker)

---

## ⚙️ Configuration (Environment Variables)

Create a `.env` file in the `relay_server` directory. You can copy the template from `.env.example`.

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `POSTGRES_USER` | Database username | `kraoq` |
| `POSTGRES_PASSWORD` | Database password | `CHANGE_ME_PASSWORD` |
| `POSTGRES_DB` | Database name | `kraoq_relay` |
| `DATABASE_URL` | Full connection string | `postgresql://user:pass@db:5432/dbname` |
| `JWT_SECRET` | Secret key for signing Auth tokens | *Generate a random 64-char string* |
| `PFX_PASSPHRASE` | Passphrase for the TLS PFX bundle | `kraoq` |
| `PORT` | Public HTTP port (Host/UI) | `3000` |
| `HTTPS_PORT` | Public HTTPS port (Mobile Sync) | `3001` |

> [!IMPORTANT]
> Change the `POSTGRES_PASSWORD` and `JWT_SECRET` for any public-facing production deployment.

---

## 🔒 Security & TLS (HTTPS)

The relay server uses a `.pfx` bundle to provide HTTPS on port 3001. This is required for mobile clients to maintain active connections (WakeLock) and secure synchronization.

### Generating a Development Certificate
If you are running in development, you can use the built-in tool:
```bash
node generate-certs.js
```
*Note: This generates `key.pem` and `cert.pem`. You may still need to bundle them if `certificate.pfx` is missing.*

### Creating the PFX Bundle
To create a valid `certificate.pfx` from PEM files:
```bash
openssl pkcs12 -export -out certificate.pfx -inkey key.pem -in cert.pem -password pass:kraoq
```
*Ensure the password matches `PFX_PASSPHRASE` in your `.env`.*

---

## 🐳 Deployment with Docker (Recommended)

1. **Configure Environment**: Edit `.env` as described above.
2. **Build and Start**:
   ```bash
   docker compose up -d --build
   ```
3. **Verify Logs**:
   ```bash
   docker compose logs -f relay
   ```

The server will be available at:
- `http://your-server-ip:3000` (Main UI & Desktop Pairing)
- `https://your-server-ip:3001` (Mobile Connection)

---

## 🛠️ Manual Node.js Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Initialize Database**: Ensure PostgreSQL is running and matches your `.env`.
3. **Start the Server**:
   ```bash
   npm start
   ```

---

## 📁 Directory Structure

- `/public`: Contains the web-based mobile client UI.
- `/auth.js`: Logic for JWT and User authentication.
- `/db.js`: Database connection pooling.
- `/index.js`: Primary entry point (Dual HTTP/HTTPS & WebSockets).
