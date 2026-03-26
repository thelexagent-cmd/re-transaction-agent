# COORDINATION_AUTH.md — Forgot Password + Email Verification Flow

## Status: Complete

---

## Backend Changes

### `backend/app/schemas/auth.py`
Added two new Pydantic schemas at the bottom of the file:
- `ForgotPasswordRequest` — accepts `email: EmailStr`
- `ResetPasswordRequest` — accepts `token: str` and `new_password: str` (with 8–128 char validator)

### `backend/app/routers/auth.py`
- Added `import secrets` to imports
- Added `ForgotPasswordRequest` and `ResetPasswordRequest` to the schema imports
- Added `_reset_tokens: dict[str, dict] = {}` in-memory store at module level (survives process lifetime, resets on deploy — acceptable for single-server Railway deployment)
- Added `POST /auth/forgot-password`:
  - Looks up user by email; returns generic 200 regardless of result (no email enumeration)
  - On hit: generates `secrets.token_urlsafe(32)`, stores with 30-minute expiry, sends HTML+text reset email via `EmailService.send()` with link `https://frontend-rose-ten-64.vercel.app/reset-password?token={token}`
- Added `POST /auth/reset-password`:
  - Validates token exists and has not expired; returns 400 "Invalid or expired reset link" on failure
  - Hashes new password via existing `_hash_password()`, updates user record, deletes token (single-use)

---

## Frontend Changes

### `frontend/app/login/page.tsx`
- Added `import Link from 'next/link'`
- Added "Forgot password?" link below the password input field (right-aligned, `text-xs text-blue-600 hover:underline`) pointing to `/forgot-password`

### `frontend/app/forgot-password/page.tsx` (new)
- Public page, no layout wrapper
- Matches login page style: centered card, Building2 logo, slate-50 background
- Email input + "Send Reset Link" button
- Calls `POST /auth/forgot-password`
- On success: green banner "Check your email for a reset link. It expires in 30 minutes."
- On error: red banner
- "Back to login" link

### `frontend/app/reset-password/page.tsx` (new)
- Public page, no layout wrapper
- Reads `?token=` from URL via `useSearchParams` (wrapped in `<Suspense>` per Next.js requirement)
- New password + confirm password inputs
- Client-side validation: min 8 chars, passwords must match
- Calls `POST /auth/reset-password`
- On success: green banner "Password reset! Redirecting to login..." then `router.replace('/login')` after 2 seconds
- On expired/invalid token: red banner "This reset link has expired or is invalid. Please request a new one." with link back to `/forgot-password`
- Matches login page style exactly

---

## Notes
- No Alembic migrations needed (tokens are in-memory)
- No new npm packages needed
- Token TTL: 30 minutes, single-use (deleted on successful reset)
- Email delivery silently skips if `GMAIL_USER`/`GMAIL_APP_PASSWORD` env vars are not set (existing EmailService behavior)
