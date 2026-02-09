# Real-Time Notifications & Socket.IO Sync

## Description

The notification system provides real-time updates across the application using Socket.IO for instant data synchronization and a notification center for user-specific alerts. Every entity change (create/update/delete) and workflow status change triggers Socket.IO events that automatically invalidate React Query caches, ensuring all users see fresh data without manual refresh. The notification center tracks approval requests, task assignments, inventory alerts, and system announcements.

**Why it exists**: To keep all users synchronized on document status changes, alert users to actions requiring their attention, and eliminate the need for manual page refreshes or polling.

## User Flow

### Socket.IO Connection Lifecycle

#### 1. Login & Connection
- User logs in via POST `/api/auth/login`
- Frontend receives JWT access token
- Frontend calls `connectSocket(token)` immediately after login
- Socket.IO client connects to server with JWT in `auth.token`
- Server validates JWT via `verifyAccessToken()`
- On success:
  - Socket joins `role:{systemRole}` room (e.g., `role:warehouse_supervisor`)
  - Socket joins `user:{userId}` room (e.g., `user:uuid-1234`)
- Connection established

#### 2. Document Subscription (Optional)
- User opens specific document (e.g., MIRV detail page)
- Frontend emits `join:document` event with `documentId`
- Socket joins `doc:{documentId}` room
- User receives all events for that document in real-time
- When user navigates away, emits `leave:document`

#### 3. Receiving Real-Time Events
- Backend performs action (e.g., MIRV approved)
- Backend emits events:
  - `emitToDocument(io, mirvId, 'mirv:approved', { id, status })`
  - `emitToAll(io, 'document:status', { documentType: 'mirv', documentId, status: 'approved' })`
  - `emitToRole(io, 'warehouse_staff', 'approval:approved', { documentType: 'mirv' })`
- Frontend `useRealtimeSync` hook listens to all events
- On `document:status` event:
  - Invalidates React Query cache: `queryClient.invalidateQueries(['mirv'])`
  - Invalidates dashboard cache: `queryClient.invalidateQueries(['dashboard'])`
- UI automatically re-fetches and displays updated data

#### 4. Logout & Disconnection
- User logs out via POST `/api/auth/logout`
- Frontend calls `disconnectSocket()`
- Socket disconnects from server
- All room memberships cleared

### Notification Center Workflow

#### 1. Notification Creation (System-Generated)
- Backend creates notification in 2 ways:
  - **Explicit**: Direct call to `createNotification()`
  - **Implicit**: Via workflow events (e.g., approval requested)
- Example: MIRV submitted for approval
  ```typescript
  await createNotification({
    userId: approverId,
    type: 'approval_request',
    title: 'MIRV Approval Required',
    message: `MIRV ${mirvNumber} awaits your approval`,
    category: 'approval',
    priority: 'high',
    relatedEntity: 'mirv',
    relatedEntityId: mirvId,
    actionUrl: `/mirv/${mirvId}`
  }, io);
  ```
- Backend creates notification record in `notifications` table
- Backend emits Socket.IO event: `notification:new` to `user:{approverId}` room
- Frontend `useRealtimeSync` hook listens, invalidates `['notifications']` cache
- Notification bell icon updates count (unread badge)

#### 2. Viewing Notifications
- User clicks notification bell icon
- Frontend fetches GET `/api/notifications?page=1&pageSize=20&unreadOnly=false`
- Displays list:
  - Title
  - Message
  - Category badge (approval/task/inventory/system/alert)
  - Priority (low/normal/high/urgent)
  - Timestamp (relative: "2 hours ago")
  - Read/Unread indicator (blue dot)
- Sorted by: priority (desc), createdAt (desc)

#### 3. Reading Notification
- User clicks on notification item
- Frontend calls PUT `/api/notifications/:id/read`
- Backend updates `isRead = true`, `readAt = NOW()`
- If `actionUrl` exists, frontend navigates to that URL (e.g., `/mirv/uuid-1234`)
- Notification badge count decrements

#### 4. Mark All as Read
- User clicks "Mark All as Read" button
- Frontend calls PUT `/api/notifications/read-all`
- Backend updates all unread notifications for user: `isRead = true`
- Returns count of updated notifications
- Notification badge count → 0

#### 5. Deleting Notification
- User clicks delete icon on notification
- Frontend calls DELETE `/api/notifications/:id`
- Backend verifies ownership (only user who received it can delete)
- Notification removed from list

#### 6. Unread Count Badge
- Displayed on notification bell icon
- Frontend fetches GET `/api/notifications/unread-count` on mount
- Returns: `{ unreadCount: 5 }`
- Badge shows "5"
- Auto-updates when `notification:new` event received

### Real-Time Cache Invalidation Flow

#### Example: MRRV Workflow
1. Warehouse staff creates MRRV → status: draft
   - Backend emits: `entity:created` { entity: 'mrrv' }
   - Frontend invalidates: `['mrrv']` cache
   - MRRV list auto-refreshes, shows new MRRV

2. Staff submits MRRV → status: pending_qc
   - Backend emits: `document:status` { documentType: 'mrrv', documentId, status: 'pending_qc' }
   - Frontend invalidates: `['mrrv']`, `['dashboard']`
   - MRRV detail page auto-updates status badge

3. QC Officer approves → status: qc_approved
   - Backend emits: `mrrv:qc_approved` { id, status }
   - Backend emits: `document:status` { documentType: 'mrrv', documentId, status: 'qc_approved' }
   - Frontend invalidates: `['mrrv']`, `['dashboard']`
   - All users viewing MRRV see updated status immediately

4. Staff stores MRRV → inventory updated
   - Backend emits: `inventory:updated` { warehouseId, mrrvId }
   - Frontend invalidates: `['inventory']`, `['dashboard', 'inventory-summary']`
   - Inventory dashboard auto-refreshes stock levels

## API Endpoints

### Notification Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications (query: page, pageSize, unreadOnly) |
| GET | `/api/notifications/unread-count` | Get unread count |
| POST | `/api/notifications` | Create notification (admin/manager only) |
| PUT | `/api/notifications/:id/read` | Mark single notification as read |
| PUT | `/api/notifications/read-all` | Mark all user's notifications as read |
| DELETE | `/api/notifications/:id` | Delete notification (owner only) |

**RBAC**: GET/PUT/DELETE available to all authenticated users. POST requires `admin` or `manager` role.

### Socket.IO Events

#### Client-to-Server Events
| Event | Payload | Description |
|-------|---------|-------------|
| `connection` | `{ auth: { token } }` | Initial connection with JWT |
| `join:document` | `documentId: string` | Subscribe to document updates |
| `leave:document` | `documentId: string` | Unsubscribe from document updates |

#### Server-to-Client Events
| Event | Payload | Description |
|-------|---------|-------------|
| `document:status` | `{ documentType, documentId, status }` | Document status changed |
| `entity:created` | `{ entity }` | New entity created |
| `entity:updated` | `{ entity }` | Entity updated |
| `entity:deleted` | `{ entity }` | Entity deleted |
| `approval:requested` | `{ documentType }` | Approval requested |
| `approval:approved` | `{ documentType }` | Approval granted |
| `approval:rejected` | `{ documentType }` | Approval denied |
| `notification:new` | `{}` | New notification created |
| `inventory:updated` | `{ warehouseId, mrrvId }` | Inventory levels changed |
| `task:assigned` | `{}` | Task assigned to user |
| `task:completed` | `{}` | Task marked completed |

## Validations

### Socket.IO Connection Validation
- JWT token required in `socket.handshake.auth.token`
- Token must be valid (not expired)
- User must be active (`isActive = true`)
- Invalid token → connection refused with error: "Invalid token"

### Notification Creation Validation
- `userId` must be valid employee ID
- `type` must be one of: approval_request, approval_approved, approval_rejected, task_assigned, task_completed, inventory_alert, system_announcement
- `title` required, max 200 characters
- `message` required, max 1000 characters
- `category` must be one of: approval, task, inventory, system, alert
- `priority` must be one of: low, normal, high, urgent
- `relatedEntityId` must be valid UUID if provided
- `actionUrl` must be valid path if provided

### Notification Read/Delete Authorization
- User can only read/delete their own notifications
- If notification belongs to different user → 403 Forbidden

## Edge Cases

### 1. Socket Disconnection During Activity
- User actively viewing MIRV detail page
- Internet connection lost, socket disconnects
- Socket.IO auto-reconnects with exponential backoff (built-in)
- On reconnection, re-joins `role:{role}` and `user:{userId}` rooms
- Does NOT auto re-join `doc:{documentId}` rooms (user must refresh page)

### 2. Token Expiry During Socket Connection
- Access token expires (15 minutes)
- Socket remains connected (initial auth still valid)
- Next HTTP API call fails with 401
- Axios interceptor refreshes token
- Socket connection NOT updated with new token
- Socket continues working until disconnect (stale token)
- On next connection, uses new token from localStorage

### 3. Multiple Browser Tabs
- User opens MIRV list in 2 tabs
- Tab 1: Creates new MIRV
- Backend emits `entity:created` to all sockets
- Tab 2: Receives event, invalidates cache, auto-refreshes list
- Both tabs show new MIRV (synchronized)

### 4. Notification for Offline User
- User A is offline
- User B approves MIRV requiring User A's next approval
- System creates notification for User A
- Notification stored in database (persistent)
- When User A logs in:
  - Fetches unread notifications via GET `/api/notifications`
  - Sees approval request immediately

### 5. Notification Spam Prevention
- Same event triggers multiple notifications (e.g., 10 MIRVs approved)
- Current: Each creates separate notification
- Future: Batch notifications (e.g., "10 MIRVs approved in last hour")
- No deduplication logic (potential spam)

### 6. Cache Invalidation Race Condition
- Socket event: `entity:updated` { entity: 'mrrv' }
- Frontend invalidates `['mrrv']` cache
- React Query re-fetches data
- Re-fetch completes BEFORE database commit finishes
- Stale data returned
- Mitigation: Backend emits event AFTER transaction commit (current implementation)

### 7. Permission-Based Event Filtering
- MIRV approved, emits `approval:approved` to all users
- Some users don't have permission to view MIRVs
- Event still received, cache invalidated
- Query re-fetch fails with 403 (no permission)
- React Query shows error, user unaffected
- Future: Emit events only to authorized roles

### 8. Document Room Memory Leak
- User opens 100 different MIRV detail pages
- Each emits `join:document` for new MIRV
- User never leaves rooms (no `leave:document`)
- Socket joins 100 rooms, memory usage increases
- Mitigation: Emit `leave:document` in component cleanup (useEffect return)

### 9. Notification Action URL Broken Link
- Notification created with `actionUrl = '/mirv/uuid-1234'`
- MIRV later deleted
- User clicks notification → navigates to 404 page
- Notification still shows in list
- Future: Auto-delete notifications when related entity deleted

### 10. High-Frequency Events (Inventory Updates)
- Bulk MRRV store operation (100 MRRVs)
- Each emits `inventory:updated` event (100 events/second)
- Frontend invalidates `['inventory']` cache 100 times
- React Query deduplicates (only 1 fetch)
- Network not overwhelmed
- But: Unnecessary event noise
- Future: Batch events (emit once after bulk operation)

## Business Rules

### 1. Socket.IO Room Structure
- **Role Rooms**: `role:{systemRole}` (e.g., `role:admin`, `role:warehouse_supervisor`)
  - Used for role-based broadcasts (e.g., all admins)
- **User Rooms**: `user:{userId}` (e.g., `user:uuid-1234`)
  - Used for user-specific notifications
- **Document Rooms**: `doc:{documentId}` (e.g., `doc:mirv-uuid-5678`)
  - Used for real-time collaboration on specific documents
  - Optional subscription (user must explicitly join)

### 2. Event Naming Convention
- Format: `{entity}:{action}` or `{category}:{action}`
- Examples:
  - `mrrv:created`, `mrrv:submitted`, `mrrv:stored`
  - `approval:requested`, `approval:approved`, `approval:rejected`
  - `inventory:updated`
  - `document:status` (generic status change)

### 3. Notification Types
- **approval_request**: Action required by user (urgent)
- **approval_approved**: FYI notification (normal)
- **approval_rejected**: FYI notification (normal)
- **task_assigned**: Action required (high)
- **task_completed**: FYI notification (normal)
- **inventory_alert**: Stock low/out (high)
- **system_announcement**: General info (normal/low)

### 4. Notification Categories
- **approval**: Approval workflow notifications
- **task**: Task management notifications
- **inventory**: Stock alerts, replenishment reminders
- **system**: System maintenance, new features
- **alert**: Urgent alerts (SLA breach, errors)

### 5. Notification Priority
- **urgent**: Red badge, persistent banner (e.g., "System down")
- **high**: Orange badge, stays at top (e.g., "Approval due in 1 hour")
- **normal**: Blue badge, standard display
- **low**: Gray badge, low priority (e.g., "Welcome message")

### 6. Notification Auto-Expiry
- Current: Notifications never expire (persist indefinitely)
- Future: Auto-delete after 30 days (configurable)
- Exception: Urgent alerts kept for 90 days (audit trail)

### 7. Cache Invalidation Strategy
React Query cache keys mapped to events:
```
'mrrv' ← entity:created/updated/deleted {entity: 'mrrv'}, document:status {documentType: 'mrrv'}
'mirv' ← entity:created/updated/deleted {entity: 'mirv'}, approval:*
'dashboard' ← document:status, inventory:updated
'notifications' ← notification:new
'inventory' ← inventory:updated
'tasks' ← task:assigned, task:completed
```

### 8. Socket.IO Transport
- Preference order: WebSocket → Polling
- WebSocket for low latency (real-time)
- Polling fallback for restrictive firewalls
- Auto-negotiates best transport

### 9. Notification Batching (Future)
- Group similar notifications within time window (e.g., 5 minutes)
- Example: "15 MIRVs approved" instead of 15 separate notifications
- Reduces notification fatigue

### 10. Event Deduplication (Current: None)
- Same event emitted multiple times (e.g., `document:status` + `mrrv:submitted`)
- Frontend may invalidate same cache twice
- React Query handles gracefully (deduplicates fetches)
- No performance issue

### 11. Notification Read Status
- `isRead = false` → shows in unread count
- `isRead = true` → grayed out, not counted
- Reading notification = clicking on it OR explicit "mark as read"
- No auto-read on viewing notification center

### 12. Notification Action URL Format
- Relative paths: `/mirv/uuid-1234`, `/dashboard`
- NOT absolute URLs: `https://example.com/...`
- Frontend uses React Router for navigation
- External links require separate field (future)

### 13. Role-Based Event Distribution
Current: Events broadcast to all users (via `emitToAll`)
Future: Filter by role/permission
```
// Example: Only warehouse staff care about MRRV events
emitToRole(io, 'warehouse_supervisor', 'mrrv:created', payload);
emitToRole(io, 'warehouse_staff', 'mrrv:created', payload);
```

### 14. Socket.IO Connection Limit
- No hard limit on connections per user
- User can open unlimited tabs/devices
- Each creates separate socket connection
- All receive same events (multiplied traffic)
- Potential abuse: Rate limiting needed (future)

### 15. Notification Dismissal
- "Delete" removes notification from database (permanent)
- No "dismiss" or "snooze" feature (future enhancement)
- Deleted notifications cannot be recovered

### 16. System-Wide Announcements
- Admin can create notification for ALL users
- Backend creates notification record for each user (N records for N users)
- Inefficient for large user base (> 1000 users)
- Future: Single announcement record + user_read_announcements junction table

### 17. Notification Email Fallback
- Current: Notifications only in-app (notification center)
- Future: Email delivery for critical notifications (approval requests, SLA breach)
- Integration with SendGrid/AWS SES

### 18. Audit Trail for Notifications
- `notifications` table includes:
  - `createdAt` - when notification created
  - `readAt` - when user read it
  - `deletedAt` - when user deleted it (soft delete)
- Used for compliance (proof of notification delivery)

### 19. Real-Time Dashboard Updates
- Dashboard widgets (KPIs, charts) use React Query
- Socket events invalidate dashboard caches
- Auto-refresh without page reload
- Example: MRRV count widget updates when new MRRV created

### 20. Performance Optimization
- Socket.IO events are lightweight (JSON payloads < 1 KB)
- No data in events (only IDs/types)
- React Query re-fetches full data (controlled)
- Prevents bandwidth waste from sending full documents in events
