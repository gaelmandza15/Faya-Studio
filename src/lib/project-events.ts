/**
 * Project event bus.
 *
 * The local adapter keeps listeners in-process on globalThis so every Next.js
 * route bundle (events, db, sync) shares the same registry. A multi-instance
 * deployment plugs a Redis pub/sub adapter behind `getProjectEventBus()`.
 */

export interface ProjectEventPayload {
  type: string;
  table?: string;
  clientId?: string;
  timestamp: string;
}

export interface ProjectEventListener {
  enqueue(chunk: Uint8Array): void;
}

export interface ProjectEventBus {
  subscribe(projectId: string, listener: ProjectEventListener): () => void;
  broadcast(projectId: string, payload: ProjectEventPayload): void;
}

const globalForEvents = globalThis as unknown as {
  __fayaProjectListeners?: Map<string, Set<ProjectEventListener>>;
  __fayaProjectEventBus?: ProjectEventBus;
};

const projectListeners: Map<string, Set<ProjectEventListener>> =
  globalForEvents.__fayaProjectListeners ??
  (globalForEvents.__fayaProjectListeners = new Map());

class MemoryProjectEventBus implements ProjectEventBus {
  subscribe(projectId: string, listener: ProjectEventListener): () => void {
    let listeners = projectListeners.get(projectId);

    if (!listeners) {
      listeners = new Set();
      projectListeners.set(projectId, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners?.delete(listener);

      if (listeners?.size === 0) {
        projectListeners.delete(projectId);
      }
    };
  }

  broadcast(projectId: string, payload: ProjectEventPayload) {
    const listeners = projectListeners.get(projectId);

    if (!listeners || listeners.size === 0) return;

    const encoded = new TextEncoder().encode(
      `data: ${JSON.stringify(payload)}\n\n`,
    );

    for (const listener of Array.from(listeners)) {
      try {
        listener.enqueue(encoded);
      } catch {
        listeners.delete(listener);
      }
    }
  }
}

export function getProjectEventBus(): ProjectEventBus {
  const provider = (process.env.EVENT_BUS ?? "memory").toLowerCase();

  if (provider !== "memory") {
    throw new Error(
      `Event bus provider "${provider}" is not implemented. Use EVENT_BUS=memory.`,
    );
  }

  if (!globalForEvents.__fayaProjectEventBus) {
    globalForEvents.__fayaProjectEventBus = new MemoryProjectEventBus();
  }

  return globalForEvents.__fayaProjectEventBus;
}

export function subscribeProject(
  projectId: string,
  listener: ProjectEventListener,
): () => void {
  return getProjectEventBus().subscribe(projectId, listener);
}

export function broadcastProjectUpdate(
  projectId: string,
  payload: ProjectEventPayload,
) {
  getProjectEventBus().broadcast(projectId, payload);
}
