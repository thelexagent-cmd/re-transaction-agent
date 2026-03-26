# Settings & Account Page — Build Summary

## Date
2026-03-26

## Status
COMPLETE

---

## Backend Changes

### `backend/app/schemas/auth.py`
- Added `UpdateProfileRequest` — validates `full_name` (optional, strip+length) and `brokerage_name` (optional, length)
- Added `ChangePasswordRequest` — validates `current_password` and `new_password` (min 8, max 128)

### `backend/app/routers/auth.py`
- `GET /auth/me` — already existed and already returns: `id, email, full_name, brokerage_name, created_at`. No changes needed.
- Added `PATCH /auth/me` — updates `full_name` and/or `brokerage_name`, commits to DB, returns updated `UserResponse`
- Added `POST /auth/change-password` — verifies current password with bcrypt, hashes + saves new password, returns 204 No Content

### Field Audit: User Model
| Field | Exists? | Nullable? | Notes |
|---|---|---|---|
| `full_name` | YES | No | Editable in profile |
| `email` | YES | No | Read-only in UI |
| `brokerage_name` | YES | Yes | Editable in profile |
| `phone` | NO | — | **Skipped** — field does not exist on the User model. No migration added. |

`phone` was intentionally skipped. To add it later: add `phone: Mapped[str | None] = mapped_column(String(50), nullable=True)` to `backend/app/models/user.py` and create an Alembic migration.

---

## Frontend Changes

### `frontend/lib/api.ts`
- Added `UserProfile` type (id, email, full_name, brokerage_name, created_at)
- Updated `getMe()` return type from `unknown` to `UserProfile`
- Added `updateMe(data)` — calls `PATCH /auth/me`
- Added `changePassword(currentPassword, newPassword)` — calls `POST /auth/change-password`

### `frontend/app/settings/layout.tsx`
- Created. Wraps in `AuthGuard` + `Sidebar`, same pattern as other section layouts.

### `frontend/app/settings/page.tsx`
- Created. Full settings page with 5 sections:
  1. **Profile** — editable full_name + brokerage_name, read-only email, saves via `PATCH /auth/me`
  2. **Change Password** — current/new/confirm inputs with show/hide toggles, calls `POST /auth/change-password`
  3. **Preferences** — language select (EN/ES/PT → `lex_default_language`), dark mode toggle (synced with `lex_dark_mode`), notification sound toggle (`lex_notif_sound`)
  4. **Branding** — display-only "Coming Soon" card with dashed border + amber badge
  5. **Billing & Plan** — display-only "Professional $49/mo" card + disabled "Manage Billing" button

### `frontend/components/layout/sidebar.tsx`
- Added `Settings` to lucide imports
- Added `{ href: '/settings', label: 'Settings', icon: Settings }` to `navItems` array

### `frontend/app/globals.css`
- Added dark mode overrides for `.settings-sidenav` (the left nav panel inside the settings page)

---

## Architecture Notes
- Settings page uses a two-column layout: 200px left nav + scrollable content area
- Each section is a self-contained component rendered conditionally by `activeSection` state
- SWR key `/auth/me` is mutated after profile save so sidebar user name updates immediately
- No new Alembic migrations created
- No `npm run build` was run
