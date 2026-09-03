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
- `DATABASE_URL=<postgresql://...>`
- `JWT_SECRET=<strong-random-secret>`
- `JWT_REFRESH_SECRET=<strong-random-secret>`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `JWT_RESET_EXPIRES_IN=1h`
- `BCRYPT_ROUNDS=10`
- `CORS_ORIGIN=https://<your-frontend>.onrender.com`
- `PUBLIC_API_URL=https://<your-backend>.onrender.com`
- `ALLOW_ONRENDER_ORIGINS=false`

### Optional
- `TELEGRAM_TEAM_CHAT_ID=<chat_id>`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

> Рекомендація: залишайте `ALLOW_ONRENDER_ORIGINS=false` і керуйте доступом лише через `CORS_ORIGIN`.

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

## 3.1) Telegram bot service (якщо потрібні повідомлення в групу)

Варіант A (рекомендовано): окремий Node Web Service на Render (root: project root).

### Build Command
`npm install`

### Start Command
`npm run start:bot`

### Required Environment Variables
- `BOT_TOKEN=<telegram-bot-token>`
- `TELEGRAM_TEAM_CHAT_ID=<group-chat-id>`
- `TELEGRAM_ADMIN_IDS=<id1,id2,...>`
- `DATABASE_URL=<той самий postgres, що у backend>`
- `PUBLIC_API_URL=https://<your-backend>.onrender.com`

### Optional (для відповіді клієнту на email з кнопки “Відповісти”)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

---

## 4) Post-deploy verification

1. Open backend health:
   - `https://<your-backend>.onrender.com/api/health`
2. Open frontend and create test booking from `/zapis`.
3. Verify booking appears in admin.
4. Login with seeded admin if needed:
   - email: `admin@finok.local`
   - password: `Test123456!`
5. Відправте тестове питання у блоці “Задати запитання менеджеру” та перевірте:
   - запис у `notification_logs`
   - повідомлення в Telegram-групу
   - роботу кнопки “Відповісти” (за наявності SMTP)

---

## 5) Common failure reasons

- **CORS mismatch**: frontend domain not in `CORS_ORIGIN`
- **Wrong API URL**: missing/incorrect `VITE_API_URL`
- **Missing DB schema sync**: backend started without `db:push`
- **Wrong JWT secrets**: cookies/tokens invalid across restarts
- **Old browser cache**: hard refresh after redeploy
