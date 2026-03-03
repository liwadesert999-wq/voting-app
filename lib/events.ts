// Simple event emitter for SSE real-time updates
type Listener = (data: unknown) => void;

class VoteEventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  subscribe(sessionId: string, listener: Listener) {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(listener);

    return () => {
      this.listeners.get(sessionId)?.delete(listener);
      if (this.listeners.get(sessionId)?.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  emit(sessionId: string, data: unknown) {
    this.listeners.get(sessionId)?.forEach((listener) => listener(data));
  }
}

// Singleton - persists across hot reloads in dev
const globalForEvents = globalThis as unknown as {
  voteEvents: VoteEventEmitter;
};

export const voteEvents =
  globalForEvents.voteEvents || new VoteEventEmitter();
globalForEvents.voteEvents = voteEvents;
