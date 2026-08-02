# Render deploy checklist (FinOk)

## 1) Deploy structure
Use **2 services** on Render:

- **Backend**: Node Web Service (root: `backend`)
- **Frontend**: Static Site (root: project root)

---

## 2) Backend service settings

### Build Command
`npm install && npm run db:push`

### Start Command
`npm start`

### Required Environment Variables
- `NODE_ENV=production`
- `PORT=10000` (Render provides one; optional to set manually)
- `DATABASE_URL=file:./dev.db`
- `JWT_SECRET=<strong-random-secret>`
- `JWT_REFRESH_SECRET=<strong-random-secret>`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `JWT_RESET_EXPIRES_IN=1h`
- `BCRYPT_ROUNDS=10`
- `CORS_ORIGIN=https://<your-frontend>.onrender.com`
- `PUBLIC_API_URL=https://<your-backend>.onrender.com`
- `ALLOW_ONRENDER_ORIGINS=true`

### Optional
- `TELEGRAM_TEAM_CHAT_ID=<chat_id>`

---

## 3) Frontend service settings

### Build Command
`npm install && npm run build`

### Publish Directory
`dist`

### Required Environment Variables
- `VITE_API_URL=https://<your-backend>.onrender.com`
- `VITE_GA_ID=<optional-ga-id>`

---

## 4) Post-deploy verification

1. Open backend health:
   - `https://<your-backend>.onrender.com/api/health`
2. Open frontend and create test booking from `/zapis`.
3. Verify booking appears in admin.
4. Login with seeded admin if needed:
   - email: `admin@finok.local`
   - password: `Test123456!`

---

## 5) Common failure reasons

- **CORS mismatch**: frontend domain not in `CORS_ORIGIN`
- **Wrong API URL**: missing/incorrect `VITE_API_URL`
- **Missing DB schema sync**: backend started without `db:push`
- **Wrong JWT secrets**: cookies/tokens invalid across restarts
- **Old browser cache**: hard refresh after redeploy
