# Route Inventory (2026-02-24)

## Public Routes (anonymous allowed)
- `/` -> redirects to `/judgment-diary` when not authenticated
- `/login`
- `/judgment-diary`
- `/judgment-diary/:slug`
- `/judgment-diary/action/:action`
- `/judgment-diary/strategy/:strategy`
- `/judgment-diary/principles`
- `/judgment-diary/reports/:month`
- `/public`
- Static assets (`/sitemap.xml`, `/robots.txt`, favicon, etc.)

## Private Routes (authentication required)
- `/dashboard`
- `/granaries/new`
- `/granaries/:id`
- `/granaries/:id/edit`
- `/snapshots/new`
- `/snapshots/:id/edit`
- `/positions/new`
- `/positions/:id/edit`
- `/judgment-diary/new`
- `/judgment-diary/:id/edit`

## API Public Routes (anonymous allowed)
- `GET /health`
- `POST /auth/google`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /public/portfolio`
- `POST /public/consulting-request`
- `GET /api/public/portfolio`
- `POST /api/public/consulting-request`
- `GET /judgment-diary`
- `GET /judgment-diary/:id`

## API Private Routes (authentication required)
- All other API endpoints requiring `gk_session` (HttpOnly session cookie)
