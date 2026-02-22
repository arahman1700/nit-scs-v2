import type { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { log } from '../config/logger.js';
import { prisma } from '../utils/prisma.js';
import { hasPermission, type Permission } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Document type → resource mapping for permission checks
// ---------------------------------------------------------------------------
const DOC_TYPE_RESOURCE: Record<string, string> = {
  mrrv: 'grn',
  grn: 'grn',
  mirv: 'mi',
  mi: 'mi',
  mrv: 'mrn',
  mrn: 'mrn',
  rfim: 'qci',
  qci: 'qci',
  osd: 'dr',
  dr: 'dr',
  mrf: 'mr',
  mr: 'mr',
  jo: 'jo',
  jobOrder: 'jo',
  gate_pass: 'gatepass',
  gatepass: 'gatepass',
  wt: 'wt',
  stock_transfer: 'wt',
  shipment: 'shipment',
  imsf: 'imsf',
  surplus: 'surplus',
  scrap: 'scrap',
};

// ---------------------------------------------------------------------------
// Socket.IO rate limiting (per-socket, in-memory)
// ---------------------------------------------------------------------------
const SOCKET_RATE_LIMIT = { maxEvents: 30, windowMs: 10_000 };
const socketEventCounts = new WeakMap<Socket, { count: number; resetAt: number }>();

function isSocketRateLimited(socket: Socket): boolean {
  const now = Date.now();
  let entry = socketEventCounts.get(socket);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + SOCKET_RATE_LIMIT.windowMs };
    socketEventCounts.set(socket, entry);
    return false;
  }
  entry.count++;
  return entry.count > SOCKET_RATE_LIMIT.maxEvents;
}

// ---------------------------------------------------------------------------
// Token re-validation interval (re-check JWT every 5 minutes on long-lived sockets)
// ---------------------------------------------------------------------------
const TOKEN_RECHECK_INTERVAL = 5 * 60 * 1000;

export function setupSocketIO(io: SocketIOServer) {
  // JWT authentication on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', socket => {
    const {
      userId,
      systemRole,
      role: legacyRole,
    } = socket.data.user as {
      userId: string;
      systemRole?: string;
      role?: string;
    };
    const role = systemRole || legacyRole;
    if (!role) {
      log('warn', `[Socket.IO] Missing role in JWT payload for user ${userId}, disconnecting`);
      socket.disconnect(true);
      return;
    }
    log('info', `[Socket.IO] Connected: ${userId} (${role})`);

    // Join role-based room
    socket.join(`role:${role}`);
    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    // Periodic token re-validation for long-lived connections
    const recheckTimer = setInterval(() => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          socket.disconnect(true);
          return;
        }
        verifyAccessToken(token);
      } catch {
        log('info', `[Socket.IO] Token expired for ${userId}, disconnecting`);
        socket.emit('auth:expired', { message: 'Token expired' });
        socket.disconnect(true);
      }
    }, TOKEN_RECHECK_INTERVAL);

    // ── join:document with access control & rate limiting ──────────────
    socket.on('join:document', async (documentId: string) => {
      // Rate limit check
      if (isSocketRateLimited(socket)) {
        socket.emit('error:rate_limit', { message: 'Too many requests' });
        return;
      }

      // Input validation
      if (!documentId || typeof documentId !== 'string' || documentId.length > 64) {
        socket.emit('error:validation', { message: 'Invalid document ID' });
        return;
      }

      try {
        // Check if the document exists and determine its type by checking common tables
        const docTables = [
          'mrrv',
          'mirv',
          'mrv',
          'materialRequisition',
          'jobOrder',
          'gatePass',
          'stockTransfer',
          'shipment',
        ] as const;
        let docType: string | null = null;

        for (const table of docTables) {
          const delegate = (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[
            table
          ];
          if (!delegate) continue;
          const found = await delegate.findUnique({ where: { id: documentId }, select: { id: true } });
          if (found) {
            docType = table;
            break;
          }
        }

        if (!docType) {
          socket.emit('error:not_found', { message: 'Document not found' });
          return;
        }

        // Permission check: user must have 'read' on the resource
        const resource = DOC_TYPE_RESOURCE[docType];
        if (resource && !hasPermission(role, resource, 'read' as Permission)) {
          socket.emit('error:forbidden', { message: 'Access denied' });
          return;
        }

        socket.join(`doc:${documentId}`);
      } catch (err) {
        log('error', `[Socket.IO] join:document failed: ${(err as Error).message}`);
        socket.emit('error:internal', { message: 'Failed to join document room' });
      }
    });

    socket.on('leave:document', (documentId: string) => {
      if (isSocketRateLimited(socket)) return;
      if (!documentId || typeof documentId !== 'string') return;
      socket.leave(`doc:${documentId}`);
    });

    socket.on('disconnect', () => {
      clearInterval(recheckTimer);
      log('debug', `[Socket.IO] Disconnected: ${userId}`);
    });
  });
}

// Emit helpers
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: unknown) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToRole(io: SocketIOServer, role: string, event: string, data: unknown) {
  io.to(`role:${role}`).emit(event, data);
}

export function emitToDocument(io: SocketIOServer, documentId: string, event: string, data: unknown) {
  io.to(`doc:${documentId}`).emit(event, data);
}

/**
 * @deprecated Use `emitEntityEvent` for role-scoped broadcasting.
 * Kept for backward compatibility with existing route files.
 */
export function emitToAll(io: SocketIOServer, event: string, data: unknown) {
  io.emit(event, data);
}

/**
 * Emit entity event only to roles that have 'read' permission on the resource.
 * Falls back to emitting to admin+manager if resource is unknown.
 */
export function emitEntityEvent(io: SocketIOServer, event: string, data: { entity: string; [key: string]: unknown }) {
  const resource = DOC_TYPE_RESOURCE[data.entity] || data.entity;
  const allRoles = [
    'admin',
    'manager',
    'warehouse_supervisor',
    'warehouse_staff',
    'logistics_coordinator',
    'site_engineer',
    'qc_officer',
    'freight_forwarder',
    'transport_supervisor',
    'scrap_committee_member',
  ];

  const targetRoles = allRoles.filter(role => hasPermission(role, resource, 'read'));
  if (targetRoles.length === 0) {
    // Fallback: at least admin sees it
    emitToRole(io, 'admin', event, data);
    return;
  }
  for (const role of targetRoles) {
    emitToRole(io, role, event, data);
  }
}
