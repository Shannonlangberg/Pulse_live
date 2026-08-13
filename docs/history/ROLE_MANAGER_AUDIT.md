# Role Manager – Audit & Enforcement Matrix

This document describes how Role Manager works across all roles and features, and confirms that toggling any part of the system on or off is enforced in both the UI and the backend.

---

## 1. Roles in Role Manager

| Role | In roleDefaults? | Notes |
|------|-------------------|--------|
| superadmin | ✅ | Full access; all toggles can restrict |
| admin | ✅ | Full access; all toggles can restrict |
| senior_leadership | ✅ | Same as admin for most features |
| senior_leader | ✅ | Same as admin for most features |
| senior_pastor | ✅ | Full access |
| lead_pastor | ✅ | Full access |
| campus_pastor | ✅ | Limited; many settings off by default |
| pastor | ✅ | Limited |
| finance | ✅ | Finance + resources only |
| staff | ✅ | Home + resources only |
| connect_group_leader | ✅ | Home, groups, events, pulse_tv |
| member | ✅ | Basic portal access |
| user | ✅ | Alias for member (used in nav) |

All roles above have entries in `roleDefaults` in `frontend/src/pages/RoleManager.jsx`, so the matrix shows the correct default (check or cross) and you can override per user.

---

## 2. Features That Can Be Turned On/Off (Enforced)

For each feature, **turning it OFF** in Role Manager:

- Hides the nav item (when the item has a `featureKey`).
- Is enforced in the backend (explicit `custom_permissions` check or `has_permission`).

| Feature key | Nav (featureKey) | Backend enforcement |
|-------------|------------------|----------------------|
| **Core / Portal** | | |
| home | Portal (home) | N/A – always visible for logged-in |
| dashboard | ✅ dashboard | `has_permission('recall_stats')` / `dashboard_access` |
| input | ✅ input | `has_permission('log_stats')` / `recall_stats` |
| finance | ✅ finance | `has_permission('finance_access')` |
| resources | ✅ resources | View resources – no admin-only export gate |
| **Settings / Admin** | | |
| database_viewer | ✅ database_viewer | ✅ Explicit denial on `/api/database_viewer`, export CSV, import |
| homepage_manager | ✅ homepage_manager | ✅ Explicit denial on all `/api/homepage-messages` admin routes |
| campus_management | ✅ campus_management | ✅ Explicit denial on `/api/v2/campuses`, `/api/campuses/create`, edit, delete |
| beacon_management | ✅ beacon_management | ✅ Explicit denial on `/api/beacon_zones`, `/api/beacons/zones` POST |
| resource_manager | ✅ resource_manager | ✅ Explicit denial on all `/api/admin/resource-categories*` and drive-overrides |
| tv_manager | ✅ tv_manager | Nav only (no TV admin API found in backend) |
| events_manager | ✅ events_manager | ✅ Explicit denial on events POST/PUT/DELETE, categories POST, upload-image |
| notifications | ✅ notifications | ✅ Explicit denial on send, schedule, scheduled, cancel, stats, test |
| data_export | ✅ data_export | ✅ `has_permission('data_export')` on `/api/export/attendance`, `/api/admin/attendance/all`; Attendance Data nav |
| region_access | In Role Manager | Not yet gated on a specific API (region used for data filtering) |
| pathway_manager | In Role Manager | Not yet gated on a specific API (pathway/Journey Manager) |

**Intentionally not overridable by Role Manager (featureKey null):**

- **Users** – user management (admin only).
- **Role Manager** – only superadmin/admin; not toggleable per user.
- **My Profile** – always visible.

---

## 3. Backend Permission Flow

1. **Custom permissions (Role Manager)**  
   Stored in `users.custom_permissions` (JSON). Loaded on login and available as `current_user.custom_permissions`.

2. **Explicit denial**  
   For admin-style features, routes check first:
   - If `custom_permissions[feature_key] is False` → **403** (and clear message).
   - Then they apply role-based or other checks.

3. **has_permission()**  
   Used for: `log_stats`, `recall_stats`, `dashboard_access`, `finance_access`, `data_export`, `manage_users`, etc.  
   It checks `custom_permissions` first (where applicable), then `role_permissions` in `app.py` (User class).

4. **Saving from Role Manager**  
   - Frontend: `POST /api/users/<id>/permissions` with `{ permissions: { ... } }`.  
   - Backend: Updates `users.custom_permissions` for that user.  
   - Users must refresh (or re-login) to see permission changes.

---

## 4. Nav Filter Logic (Frontend)

In `EnhancedNavigation.jsx` and `TopNavigation.jsx`:

- If the item has a `featureKey` **and** `customPermissions` has that key:
  - Show only if `customPermissions[featureKey] === true`.
- Otherwise:
  - Show if the user’s role is in the item’s `roles` array.

So:

- **Turn OFF** in Role Manager → key is set to `false` → nav item hidden (and API denied).
- **Turn ON** for a role that doesn’t have it by default → key set to `true` → nav item shown (and API allowed if backend uses same key or has_permission).

---

## 5. Summary: “Turn On or Off Any Part of the System”

- **All roles** used in the app have defaults in Role Manager (`roleDefaults`), including `user` (alias for member).
- **All settings features** that have a `featureKey` in the nav can be turned on or off per user; turning off hides the nav and is enforced in the backend for the routes listed above.
- **Core portal features** (dashboard, input, finance) are controlled by `has_permission` and `custom_permissions` (e.g. `input`, `dashboard`, `finance`, `data_export`).
- **Users** and **Role Manager** are intentionally not toggleable (admin-only, no featureKey).
- **TV Manager** is toggleable in the nav; backend TV admin routes (if any are added later) should check `custom_permissions.tv_manager`.
- **Region Access** and **Pathway Manager** are in the Role Manager matrix; any future admin APIs for these should check `custom_permissions.region_access` and `custom_permissions.pathway_manager` respectively.

After changes in Role Manager, users should **refresh the browser** (or log out and back in) so their session and nav reflect the new permissions.
