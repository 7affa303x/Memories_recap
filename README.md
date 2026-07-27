# Memorys Recap

تطبيق لتجميع الذكريات — مع تسجيل دخول عبر **Google OAuth** (Auth.js).

## إعداد Google OAuth (مطلوب مرة واحدة)

في [Google Cloud Console](https://console.cloud.google.com/auth/clients):

1. افتح عميل OAuth الذي أنشأته.
2. أضف في **Authorized JavaScript origins**:
   - `http://localhost:3000`
3. أضف في **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
4. احفظ التغييرات.

> ملاحظة: التطبيق في وضع Testing — أضف بريدك كـ Test user من شاشة OAuth consent.

## المتغيرات البيئية

انسخ القالب ثم املأ القيم:

```bash
cp .env.example .env.local
```

| المتغير | الوصف |
|---|---|
| `AUTH_SECRET` | سر عشوائي للجلسات |
| `AUTH_URL` | `http://localhost:3000` محلياً |
| `AUTH_GOOGLE_ID` | Client ID من Google |
| `AUTH_GOOGLE_SECRET` | Client Secret من Google |

لا ترفع `.env.local` إلى Git.

## التشغيل

```bash
npm install
npm run dev
```

ثم افتح [http://localhost:3000](http://localhost:3000) واضغط **المتابعة مع Google**.

## المسارات

- `/` — الصفحة الرئيسية + زر Google
- `/signin` — صفحة تسجيل الدخول
- `/dashboard` — محمية؛ تظهر بعد نجاح OAuth
- `/api/auth/*` — مسارات Auth.js
