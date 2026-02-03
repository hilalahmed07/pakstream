import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

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

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
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

  // Chat methods
  sendMessage(premiereId: string, message: string, username?: string) {
    const socket = this.getSocket();
    if (socket) {
      socket.emit('send-message', premiereId, message, username);
    }
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
