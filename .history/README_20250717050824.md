# Web Crawler Dashboard

A full-stack web application for crawling URLs, extracting page information (HTML version, title, heading counts, links, login form), and displaying results in a modern React/MUI dashboard. The backend is written in Go, the frontend in React/TypeScript, and data is stored in MySQL.

---

## Features

- **Crawl any URL** and extract:
  - HTML version, title, heading counts (h1-h6)
  - Internal, external, and broken links (with details)
  - Login form detection
- **Dashboard** with:
  - Pagination, filtering, sorting
  - Bulk actions (delete, re-run analysis)
  - Real-time status updates and polling
  - Broken link details modal
- **Re-run analysis** for any URL
- **Dockerized** for easy local development

---

## ⚠️ Security Note

> **The default database password is for local development only.**
> **Never commit production secrets or passwords to your repository.**
> For production, always use strong, unique passwords and inject them via environment variables or a secrets manager. See the `.env` pattern below for safer local development.

---

## Quick Start (with Docker)

### 1. Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed

### 2. Start All Services

```sh
docker-compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080/api
- **MySQL:** localhost:3307 (user: `root`, password: `rootpw`, db: `crawler`)

### 3. Stopping

```sh
docker-compose down
```

---

## Using a .env File (Recommended for Local Dev)

Create a `.env` file in the project root:

```
MYSQL_ROOT_PASSWORD=yourpassword
MYSQL_DATABASE=crawler
DB_USER=root
DB_PASS=yourpassword
DB_NAME=crawler
DB_HOST=mysql
```

Update your `docker-compose.yml` to use these variables:

```yaml
environment:
  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
  MYSQL_DATABASE: ${MYSQL_DATABASE}
```

---

## Manual Development Setup

### Backend (Go)

1. **Install Go 1.21+**
2. **Install dependencies:**
   ```sh
   cd backend
   go mod tidy
   ```
3. **Set up MySQL** (see Docker section for credentials)
4. **Run the backend:**
   ```sh
   go run main.go
   ```
   - The backend expects MySQL at `mysql:3306` (Docker) or `localhost:3306` (local).
   - Update the DSN in `main.go` if running MySQL locally.

### Frontend (React/TypeScript)

1. **Install Node.js 18+**
2. **Install dependencies:**
   ```sh
   cd frontend
   npm install
   ```
3. **Start the frontend:**
   ```sh
   npm run dev
   ```
   - The app runs at http://localhost:3000
   - API requests to `/api` are proxied to the backend (see `vite.config.ts`).

---

## Database

- MySQL 8 is used for persistent storage.
- The schema is automatically created by the backend on first run.
- Data is stored in `urls` and `broken_links` tables.

---

## Project Structure

```
.
├── backend/      # Go backend (API, crawler, models, handlers)
├── frontend/     # React frontend (MUI dashboard)
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

- `POST   /api/urls`           — Add and crawl a new URL
- `GET    /api/urls`           — List URLs (with pagination/filtering)
- `GET    /api/urls/:id`       — Get details for a URL
- `GET    /api/urls/:id/broken`— Get broken link details for a URL
- `PUT    /api/urls/:id`       — Update a URL
- `DELETE /api/urls/:id`       — Delete a URL
- `POST   /api/urls/bulk-delete`   — Bulk delete URLs
- `POST   /api/urls/bulk-restart`  — Bulk re-crawl URLs
- `PUT    /api/urls/:id/start`     — Re-crawl a single URL

---

## Environment Variables

- See `docker-compose.yml` for all environment variables.
- Backend uses:
  - `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`

---

## Notes

- The frontend uses [MUI DataGrid](https://mui.com/x/react-data-grid/) for the dashboard.
- The backend uses [Gin](https://github.com/gin-gonic/gin) and [goquery](https://github.com/PuerkitoBio/goquery) for crawling and parsing.
- All containers are rebuilt on `docker-compose up --build`.

---

## Troubleshooting

- **Port conflicts:** Make sure ports 3000 (frontend), 8080 (backend), and 3307 (MySQL) are free.
- **Database errors:** If MySQL fails to start, try removing the `db_data` Docker volume:
  ```sh
  docker volume rm project_db_data
  ```
- **Frontend/backend changes:** Rebuild containers after code changes:
  ```sh
  docker-compose up --build
  ```

---
