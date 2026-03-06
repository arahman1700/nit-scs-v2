## ADDED Requirements

### Requirement: Access token stored in httpOnly cookie
The system SHALL store the JWT access token in an httpOnly, Secure, SameSite=Strict cookie instead of localStorage. The cookie SHALL be set by the backend on successful login and token refresh responses.

#### Scenario: Successful login sets auth cookie
- **WHEN** user submits valid credentials to POST /auth/login
- **THEN** response includes a `Set-Cookie` header with `access_token` cookie (httpOnly, Secure, SameSite=Strict, Path=/)

#### Scenario: Token refresh updates auth cookie
- **WHEN** client calls POST /auth/refresh with valid refresh token
- **THEN** response includes updated `access_token` cookie with new JWT

#### Scenario: Logout clears auth cookie
- **WHEN** user calls POST /auth/logout
- **THEN** response clears the `access_token` cookie (Max-Age=0)

### Requirement: Backend reads token from cookie
The backend auth middleware SHALL read the JWT access token from the `access_token` cookie. During migration, it SHALL also accept the Authorization header as fallback.

#### Scenario: Authenticated request via cookie
- **WHEN** request includes valid `access_token` cookie
- **THEN** middleware extracts and validates the JWT, attaching user context to the request

#### Scenario: Missing cookie and no Authorization header
- **WHEN** request has no `access_token` cookie and no Authorization header
- **THEN** middleware returns 401 Unauthorized

### Requirement: CSRF protection on mutating endpoints
The system SHALL implement double-submit cookie CSRF protection. A non-httpOnly `csrf_token` cookie SHALL be set on login. All POST/PUT/PATCH/DELETE requests MUST include an `X-CSRF-Token` header matching the cookie value.

#### Scenario: Valid CSRF token
- **WHEN** mutating request includes `X-CSRF-Token` header matching the `csrf_token` cookie
- **THEN** request proceeds normally

#### Scenario: Missing CSRF token
- **WHEN** mutating request omits `X-CSRF-Token` header
- **THEN** server returns 403 Forbidden with error "CSRF token missing"

#### Scenario: Mismatched CSRF token
- **WHEN** `X-CSRF-Token` header value does not match `csrf_token` cookie
- **THEN** server returns 403 Forbidden with error "CSRF token invalid"

### Requirement: Frontend uses cookie-based auth
The frontend Axios client SHALL use `withCredentials: true` for all API requests. It SHALL read the `csrf_token` cookie and include it as `X-CSRF-Token` header on mutating requests. It SHALL NOT store tokens in localStorage.

#### Scenario: API request includes credentials
- **WHEN** frontend makes any API request
- **THEN** Axios sends cookies automatically via `withCredentials: true`

#### Scenario: Mutating request includes CSRF header
- **WHEN** frontend makes a POST/PUT/PATCH/DELETE request
- **THEN** Axios interceptor reads `csrf_token` from document.cookie and sets `X-CSRF-Token` header
