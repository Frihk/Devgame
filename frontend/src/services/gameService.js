let cmdCounter = 0;

class GameService {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
    this.pendingSend = [];
    this.pendingCmds = new Map(); // cmdId -> { resolve, reject, timer }
  }

  connect(gameId, token) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.socket) this.socket.close();

    const wsUrl = `ws://localhost:8080/ws/game/${gameId}?token=${token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      for (const msg of this.pendingSend) {
        this.socket.send(JSON.stringify(msg));
      }
      this.pendingSend = [];
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const cmdId = msg.cmdId;
        if (cmdId && this.pendingCmds.has(cmdId)) {
          const entry = this.pendingCmds.get(cmdId);
          clearTimeout(entry.timer);
          this.pendingCmds.delete(cmdId);
          if (msg.type === 'error') {
            entry.reject(new Error(msg.payload?.message || 'Command failed'));
          } else {
            entry.resolve(msg);
          }
        }
        this.listeners.forEach((cb) => cb(msg));
      } catch (err) {
        console.error('WS error:', err);
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      for (const [, entry] of this.pendingCmds) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Connection closed'));
      }
      this.pendingCmds.clear();
    };

    this.socket.onerror = () => {};
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  sendAction(actionType, payload = {}) {
    return new Promise((resolve, reject) => {
      const cmdId = `cmd_${++cmdCounter}_${Date.now()}`;
      const frame = { type: actionType, payload, cmdId };

      const timer = setTimeout(() => {
        this.pendingCmds.delete(cmdId);
        reject(new Error(`Command "${actionType}" timed out`));
      }, 10000);

      this.pendingCmds.set(cmdId, { resolve, reject, timer });

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(frame));
      } else {
        this.pendingSend.push(frame);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.pendingSend = [];
    for (const [, entry] of this.pendingCmds) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Disconnected'));
    }
    this.pendingCmds.clear();
  }
}

const gameService = new GameService();
export default gameService;
