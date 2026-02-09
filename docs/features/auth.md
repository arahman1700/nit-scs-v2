# Authentication & Authorization

## Description

The authentication system provides secure access control using JWT (JSON Web Tokens) with automatic token refresh, role-based access control (RBAC), and session management. It supports email/password login, forgot password flow with 6-digit codes, password change, and automatic session restoration on page reload.

**Why it exists**: To ensure only authorized users can access the system and that users can only perform actions permitted by their role.

## User Flow

### Login Flow
1. User enters email and password on `/login` page
2. Frontend sends POST `/api/auth/login` with credentials
3. Backend validates credentials against `employee` table
4. On success, backend returns:
   - Access token (15 minutes expiry)
   - Refresh token (7 days expiry)
   - User object (id, fullName, email, role, systemRole, department)
5. Frontend stores both tokens in localStorage:
   - `nit_scs_token` (access token)
   - `nit_scs_refresh_token` (refresh token)
6. Frontend caches user data in React Query under `['auth', 'me']`
7. User is redirected to role-specific dashboard

### Session Restoration
1. On app load, if `nit_scs_token` exists in localStorage
2. Frontend automatically sends GET `/api/auth/me` with token in Authorization header
3. Backend verifies token and returns current user data
4. Frontend hydrates user state, enabling authenticated navigation

### Automatic Token Refresh
1. When any API call returns 401 Unauthorized
2. Axios interceptor catches the error
3. Interceptor attempts to refresh using POST `/api/auth/refresh` with `nit_scs_refresh_token`
4. On success:
   - New access and refresh tokens are stored
   - Original request is retried with new access token
5. On failure:
   - Tokens are cleared from localStorage
   - User is redirected to `/login`

### Forgot Password Flow
1. User clicks "Forgot Password" on login page
2. User enters email → POST `/api/auth/forgot-password`
3. Backend generates 6-digit code (15-minute expiry)
4. Backend logs code to console (in production: sends email)
5. User enters code + new password → POST `/api/auth/reset-password`
6. Backend validates code and updates password hash
7. User can now login with new password

### Change Password (Authenticated)
1. User navigates to Settings → Change Password
2. User enters current password + new password
3. POST `/api/auth/change-password` (requires authentication)
4. Backend verifies current password before updating

### Logout Flow
1. User clicks Logout
2. Frontend sends POST `/api/auth/logout` (server acknowledgment only)
3. Frontend clears localStorage tokens
4. Frontend clears all React Query caches
5. User is redirected to `/login`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login with email/password |
| POST | `/api/auth/refresh` | No | Refresh access token using refresh token |
| GET | `/api/auth/me` | Yes | Get current user profile |
| POST | `/api/auth/change-password` | Yes | Change password (requires current password) |
| POST | `/api/auth/forgot-password` | No | Request password reset code |
| POST | `/api/auth/reset-password` | No | Reset password with code |
| POST | `/api/auth/logout` | Yes | Logout (client-side token deletion) |

### Request/Response Examples

**POST /api/auth/login**
```json
// Request
{
  "email": "ahmed@nit.com.sa",
  "password": "SecurePass123"
}

// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "ahmed@nit.com.sa",
      "fullName": "Ahmed Al-Rashid",
      "role": "Warehouse Supervisor",
      "systemRole": "warehouse_supervisor",
      "department": "warehouse"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**POST /api/auth/forgot-password**
```json
// Request
{ "email": "ahmed@nit.com.sa" }

// Response (same for existing/non-existing users - security)
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a reset code has been sent."
  }
}
```

**POST /api/auth/reset-password**
```json
// Request
{
  "email": "ahmed@nit.com.sa",
  "code": "123456",
  "newPassword": "NewSecurePass456"
}

// Response
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully."
  }
}
```

## Validations

### Login Schema
- `email`: Required, valid email format
- `password`: Required, min 6 characters

### Change Password Schema
- `currentPassword`: Required
- `newPassword`: Required, min 6 characters, must differ from current

### Forgot Password Schema
- `email`: Required, valid email format

### Reset Password Schema
- `email`: Required, valid email format
- `code`: Required, exactly 6 digits
- `newPassword`: Required, min 6 characters

### Backend Validations
- User must exist in `employee` table
- User must be active (`isActive = true`)
- Password must match hash (bcrypt comparison)
- Reset code must be valid and not expired (15 minutes)

## Edge Cases

### 1. Account Deactivation
- If user account is deactivated (`isActive = false`) after login
- On next API call or `/me` request → 401 error → forced logout
- On token refresh → "User not found or deactivated" error

### 2. Concurrent Sessions
- Multiple browser tabs/devices can use the same token
- Token refresh in one tab updates localStorage, but other tabs don't auto-detect
- User may need to manually refresh or reload other tabs
- Socket.IO connections use per-connection tokens (independent)

### 3. Expired Refresh Token
- If refresh token expires (7 days) or is invalid
- Interceptor fails to refresh → user is logged out
- User must re-login from scratch

### 4. Invalid Refresh Token (Modified/Corrupted)
- If localStorage token is tampered with
- Refresh fails → immediate logout

### 5. Password Reset Code Security
- Code is case-sensitive
- 15-minute expiry strictly enforced
- Code is deleted after successful reset
- No rate limiting (production should add)

### 6. Role Mapping
- Backend stores `systemRole` as string (e.g., "warehouse_supervisor")
- Frontend uses `UserRole` enum
- Mismatch requires type casting: `user.systemRole as UserRole`

### 7. Socket.IO Authentication
- Socket connects with JWT from localStorage
- If token expires, socket disconnects
- Frontend does NOT auto-reconnect socket on token refresh
- User may need to reconnect socket manually or reload page

### 8. Protected Routes (Frontend)
- If `nit_scs_token` is missing → redirect to `/login`
- If `/me` request fails → redirect to `/login`
- No role-based route protection on frontend (relies on backend RBAC)

## Business Rules

### 1. System Roles (8 Total)
Stored in `employee.systemRole` column:
- `admin` - Full system access
- `manager` - Department head / Operations Director
- `warehouse_supervisor` - Warehouse manager
- `warehouse_staff` - Storekeeper
- `logistics_coordinator` - Logistics coordination
- `site_engineer` - Project site engineer
- `qc_officer` - Quality control officer
- `freight_forwarder` - Freight forwarding (external)

### 2. Role-Dashboard Mapping
Each role has a dedicated dashboard:
- `admin` → `/admin`
- `manager` → `/manager`
- `warehouse_supervisor` → `/warehouse`
- `warehouse_staff` → `/warehouse` (same as supervisor)
- `logistics_coordinator` → `/logistics`
- `site_engineer` → `/site-engineer`
- `qc_officer` → `/qc-officer`
- `freight_forwarder` → (no dedicated dashboard)

### 3. JWT Token Expiry
- Access token: 15 minutes (short-lived for security)
- Refresh token: 7 days (long-lived for UX)
- Why? Balance between security (frequent re-auth) and user experience (no constant re-login)

### 4. Password Requirements
- Minimum 6 characters (production should enforce stronger rules)
- Hashed using bcrypt (salt rounds: 10)
- Current password required for change (prevents session hijacking)

### 5. RBAC Enforcement
- Backend routes use `requireRole(...roles)` middleware
- Checks if `req.user.systemRole` is in allowed roles
- Returns 403 Forbidden if unauthorized
- Frontend uses `hasPermission(user, permissionKey)` for UI-level hiding

### 6. Permission Mapping
Defined in `@nit-scs/shared/permissions.ts`:
```typescript
// Example: MIRV creation requires one of these roles
'mirv:create': ['admin', 'manager', 'site_engineer', 'warehouse_supervisor']
```

### 7. Session Persistence
- Tokens stored in `localStorage` (not `sessionStorage`)
- Persists across browser restarts
- User stays logged in until token expires or manual logout

### 8. Last Login Tracking
- `employee.lastLogin` updated on successful login
- Used for audit/analytics

### 9. No Password Reset via Email (Current Implementation)
- Reset code only logged to backend console
- Production should integrate email service (e.g., SendGrid)

### 10. No Rate Limiting (Current)
- Production should add rate limiting on:
  - Login attempts (brute force protection)
  - Password reset requests (spam protection)
  - Token refresh (abuse protection)
