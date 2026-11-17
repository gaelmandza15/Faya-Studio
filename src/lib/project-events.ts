/**
 * In-process registry of connected project listeners used by the SSE route.
 *
 * Stored on globalThis so every Next.js route bundle (events, db, sync) shares
 * the same map in a single server process. A multi-instance deployment needs a
 * shared pub/sub (Redis, Postgres LISTEN/NOTIFY, etc.).
 */

interface ProjectEventPayload {
  type: string;
  table?: string;
  clientId?: string;
  timestamp: string;
}

interface ProjectListener {
  enqueue(chunk: Uint8Array): void;
}

const globalForEvents = globalThis as unknown as {
  __fayaProjectListeners?: Map<string, Set<ProjectListener>>;
  __fayaProjectSlots?: Map<string, number>;
};

const projectListeners: Map<string, Set<ProjectListener>> =
  globalForEvents.__fayaProjectListeners ??
  (globalForEvents.__fayaProjectListeners = new Map<
    string,
    Set<ProjectListener>
  >());

const projectSlots: Map<string, number> =
  globalForEvents.__fayaProjectSlots ??
  (globalForEvents.__fayaProjectSlots = new Map<string, number>());

export function acquireProjectSlot(key: string, max = 5): boolean {
  const current = projectSlots.get(key) ?? 0;

  if (current >= max) return false;

  projectSlots.set(key, current + 1);
  return true;
}

export function releaseProjectSlot(key: string) {
  const current = projectSlots.get(key) ?? 0;

  if (current <= 1) {
    projectSlots.delete(key);
  } else {
    projectSlots.set(key, current - 1);
  }
}

export function subscribeProject(
  projectId: string,
  controller: ProjectListener,
): () => void {
  let listeners = projectListeners.get(projectId);

  if (!listeners) {
    listeners = new Set();
    projectListeners.set(projectId, listeners);
  }

  listeners.add(controller);

  return () => {
    listeners?.delete(controller);

    if (listeners?.size === 0) {
      projectListeners.delete(projectId);
    }
  };
}

export function broadcastProjectUpdate(
  projectId: string,
  payload: ProjectEventPayload,
) {
  const listeners = projectListeners.get(projectId);

  if (!listeners || listeners.size === 0) return;

  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify(payload)}\n\n`,
  );

  for (const controller of Array.from(listeners)) {
    try {
      controller.enqueue(encoded);
    } catch {
      listeners.delete(controller);
    }
  }
}
