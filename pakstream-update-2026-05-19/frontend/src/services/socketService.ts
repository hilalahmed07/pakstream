import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

export interface SocketAck {
  ok: boolean;
  error?: { code: string; action?: string; message: string };
}

export interface SocketError {
  code?: string;
  action?: string;
  message: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected, reusing existing connection');
      return this.socket;
    }

    if (this.socket && !this.socket.connected) {
      console.log('Socket exists but disconnected, reconnecting...');
      this.socket.connect();
      return this.socket;
    }

    console.log('Creating new Socket.IO connection...');
    const token = localStorage.getItem('token');
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      auth: {
        token: token || null
      },
      extraHeaders: token ? {
        Authorization: `Bearer ${token}`
      } : {}
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server, ID:', this.socket?.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server. Reason:', reason);
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    // Always-on force-logout listener tied to the socket instance itself.
    // This guarantees real-time sign-out the moment the backend evicts the
    // session, regardless of React render timing or which component happens
    // to be mounted. It re-dispatches the payload as a `force-logout` window
    // event so the AppContent handler can render the notice + tear down auth.
    this.socket.on('force-logout', (payload: { reason?: string; message?: string } = {}) => {
      console.log('⚠️ Server requested force-logout:', payload?.reason);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('force-logout', { detail: payload }));
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Tear down any existing socket and re-open with the current localStorage
   * token. Call this whenever auth state changes (login, logout, token
   * refresh) so the backend sees the correct userRole for the fresh
   * handshake — otherwise an admin who logs in after the socket already
   * connected is treated as anonymous/viewer and can't drive premieres.
   */
  reconnectWithCurrentAuth() {
    this.disconnect();
    this.activeRooms.clear();
    this.joinTimestamps.clear();
    this.connect();
  }

  getSocket() {
    if (!this.socket) {
      this.connect();
    }
    return this.socket;
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  // Generic event listeners
  on(event: string, callback: (...args: any[]) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.off(event, callback);
    }
  }

  // Premiere-related methods
  private activeRooms: Set<string> = new Set();
  private joinTimestamps: Map<string, number> = new Map();
  
  joinPremiere(premiereId: string) {
    const socket = this.getSocket();
    if (!socket) return;
    
    // Prevent duplicate joins within 2 seconds (debounce)
    const now = Date.now();
    const lastJoin = this.joinTimestamps.get(premiereId);
    if (lastJoin && (now - lastJoin) < 2000) {
      console.log('⚠️ Blocked duplicate join attempt for:', premiereId);
      return;
    }
    
    if (this.activeRooms.has(premiereId)) {
      console.log('⚠️ Already in premiere room:', premiereId);
      return;
    }
    
    console.log('✅ Joining premiere room:', premiereId);
    socket.emit('join-premiere', premiereId);
    this.activeRooms.add(premiereId);
    this.joinTimestamps.set(premiereId, now);
  }

  leavePremiere(premiereId: string) {
    const socket = this.getSocket();
    if (!socket) return;
    
    if (!this.activeRooms.has(premiereId)) {
      console.log('⚠️ Not in premiere room:', premiereId);
      return;
    }
    
    console.log('🚪 Leaving premiere room:', premiereId);
    socket.emit('leave-premiere', premiereId);
    this.activeRooms.delete(premiereId);
    this.joinTimestamps.delete(premiereId);
  }

  // Admin controls
  startPremiere(premiereId: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('admin-start-premiere', premiereId);
    }
  }

  endPremiere(premiereId: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('admin-end-premiere', premiereId);
    }
  }

  // Video controls
  /**
   * Admin-only playback controls.
   * The server enforces role checks; viewers should never call these.
   */
  playVideo(premiereId: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('play-video', premiereId);
    }
  }

  pauseVideo(premiereId: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('pause-video', premiereId);
    }
  }

  seekVideo(premiereId: string, time: number) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('seek-video', premiereId, time);
    }
  }

  /**
   * Ack-based variants of the admin controls. Returns a promise that resolves
   * with { ok, error } so the caller can surface backend rejections (forbidden,
   * not-found, etc.) to the user instead of the emit disappearing silently.
   */
  playVideoWithAck(premiereId: string, timeoutMs = 3000): Promise<SocketAck> {
    return this.emitWithAck('play-video', [premiereId], timeoutMs);
  }

  pauseVideoWithAck(premiereId: string, timeoutMs = 3000): Promise<SocketAck> {
    return this.emitWithAck('pause-video', [premiereId], timeoutMs);
  }

  seekVideoWithAck(premiereId: string, time: number, timeoutMs = 3000): Promise<SocketAck> {
    return this.emitWithAck('seek-video', [premiereId, time], timeoutMs);
  }

  private emitWithAck(event: string, args: any[], timeoutMs: number): Promise<SocketAck> {
    return new Promise((resolve) => {
      const socket = this.getSocket();
      if (!socket) {
        resolve({ ok: false, error: { code: 'NO_SOCKET', message: 'Not connected' } });
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: { code: 'TIMEOUT', message: 'No response from server' } });
      }, timeoutMs);
      socket.emit(event, ...args, (response: SocketAck) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(response ?? { ok: true });
      });
    });
  }

  // Chat methods
  sendMessage(premiereId: string, message: string, username?: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('send-message', premiereId, message, username);
    }
  }

  sendMessageWithAck(premiereId: string, message: string, username?: string, timeoutMs = 3000): Promise<SocketAck> {
    return this.emitWithAck('send-message', [premiereId, message, username], timeoutMs);
  }

  // Event listeners
  onPremiereJoined(callback: (data: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('premiere-joined', callback);
    }
  }

  onViewerJoined(callback: (data: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('viewer-joined', callback);
    }
  }

  onViewerLeft(callback: (data: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('viewer-left', callback);
    }
  }

  onPremiereStarted(callback: (data: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('premiere-started', callback);
    }
  }

  onPremiereEnded(callback: (data: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('premiere-ended', callback);
    }
  }

  onVideoPlay(callback: () => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('video-play', callback);
    }
  }

  onVideoPause(callback: () => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('video-pause', callback);
    }
  }

  onVideoSeek(callback: (data: { time: number }) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('video-seek', callback);
    }
  }

  onNewMessage(callback: (message: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('new-message', callback);
    }
  }

  onError(callback: (error: any) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('error', callback);
    }
  }

  // Called by admin dashboards to react live when another admin deletes a premiere.
  onPremiereDeleted(callback: (data: { premiereId: string }) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('premiere-deleted', callback);
    }
  }

  offPremiereDeleted(callback?: (data: { premiereId: string }) => void) {
    const socket = this.getSocket();
    if (socket) {
      socket.off('premiere-deleted', callback);
    }
  }

  // Remove all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Remove specific listener
  removeListener(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Utility methods
  getTimeUntilEnd(endTime: string): number {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    return Math.max(0, end - now);
  }

  getTimeUntilStart(startTime: string): number {
    const now = new Date().getTime();
    const start = new Date(startTime).getTime();
    return Math.max(0, start - now);
  }
}

const socketService = new SocketService();
export default socketService;
