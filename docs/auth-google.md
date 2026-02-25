# Google OAuth Setup (Cloudflare Workers)

## 1) Google Cloud Console
- OAuth Client Type: Web Application
- Authorized JavaScript origins:
  - `http://localhost:5173`
  - `https://gokkan-keeper.yetimates.com`
- Use the issued Client ID as `GOOGLE_CLIENT_ID`.

## 2) Worker Environment Variables
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `ALLOWED_EMAIL`: single admin email address allowed to log in
- `SESSION_SECRET`: random secret (32+ bytes recommended)
- `ALLOWED_SUB` (optional): fixed Google account subject for stronger binding

## 3) Frontend Environment Variable
- `VITE_GOOGLE_CLIENT_ID`: same value as `GOOGLE_CLIENT_ID`

## 4) Login Flow (MVP)
1. `/login` loads Google Identity Services button.
2. Browser receives Google ID token (`credential`).
3. Frontend calls `POST /auth/google` with `{ credential, next }`.
4. Worker validates token via `tokeninfo` and allowed account checks.
5. Worker sets HttpOnly session cookie (`gk_session`).
6. Frontend redirects to `next` (default: `/dashboard`).

## 5) Logout
- `POST /auth/logout`
- Worker clears `gk_session` cookie.
