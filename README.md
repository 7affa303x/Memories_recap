# Memorys Recap

تطبيق لتجميع الذكريات — مربوط بـ **Google OAuth** + **Supabase** + **Vercel**.

## المنصات

| المنصة | التفاصيل |
|---|---|
| GitHub | `7affa303x/Memorys_recap` |
| Vercel | Team `ALGERIA` (`algeria1`) / project `memories-recap` |
| Supabase | Org `ALGERIA` / project ref `msxizizltsjgenkczpgs` |
| Google OAuth | Auth.js Google provider |

الأسرار تُحفظ في `.env.local` محلياً وفي Environment Variables على Vercel — **لا تُرفع إلى Git**.

## إعداد Google OAuth

في [Google Cloud Console](https://console.cloud.google.com/auth/clients):

1. **Authorized JavaScript origins:** `http://localhost:3000`
2. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`
3. أضف بريدك كـ **Test user** في OAuth consent screen.

بعد نشر Vercel، أضف أيضاً دومين الإنتاج ونفس مسار الـ callback.

## المتغيرات البيئية

```bash
cp .env.example .env.local
# أو: npx vercel env pull .env.local --yes --scope algeria1
```

المفاتيح المطلوبة: `AUTH_*` و `NEXT_PUBLIC_SUPABASE_*` و `SUPABASE_*` و `DATABASE_URL`.

## التشغيل

```bash
npm install
npm run dev
```

- الصفحة: [http://localhost:3000](http://localhost:3000)
- فحص Supabase: [http://localhost:3000/api/health/supabase](http://localhost:3000/api/health/supabase)

## المسارات

- `/` — الرئيسية + Google
- `/signin` — تسجيل الدخول
- `/dashboard` — محمية بعد OAuth
- `/api/auth/*` — Auth.js
- `/api/health/supabase` — فحص اتصال Supabase
