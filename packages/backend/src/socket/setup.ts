import type { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { log } from '../config/logger.js';

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

  io.on('connection', (socket) => {
    const { userId, role } = socket.data.user;
    log('info', `[Socket.IO] Connected: ${userId} (${role})`);

    // Join role-based room
    socket.join(`role:${role}`);
    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    socket.on('join:document', (documentId: string) => {
      socket.join(`doc:${documentId}`);
    });

    socket.on('leave:document', (documentId: string) => {
      socket.leave(`doc:${documentId}`);
    });

    socket.on('disconnect', () => {
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

export function emitToAll(io: SocketIOServer, event: string, data: unknown) {
  io.emit(event, data);
}
