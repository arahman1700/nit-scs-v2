import { io, Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Socket.IO Client Singleton
// ---------------------------------------------------------------------------
// Connects to the backend WebSocket for real-time events (notifications,
// document status changes, inventory updates, etc.).
//
// The connection is NOT automatic — call connectSocket(token) after login
// and disconnectSocket() on logout.
// ---------------------------------------------------------------------------

const SOCKET_URL = import.meta.env.VITE_WS_URL || '/';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('nit_scs_token') || '' },
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    // Reconnect with fresh token if auth fails
    socket.on('connect_error', err => {
      if (err.message === 'Authentication error') {
        const freshToken = localStorage.getItem('nit_scs_token');
        if (freshToken && socket) {
          socket.auth = { token: freshToken };
        }
      }
    });
  }
  return socket;
}

export function connectSocket(token: string) {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
