export interface LatestSaveQueueOptions<T> {
  /** Tries for the value that is still current. A newer push replaces it. */
  attempts?: number;
  retryDelayMs?: number;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
}

export interface LatestSaveQueue<T> {
  push: (value: T) => void;
  whenIdle: () => Promise<void>;
}

/**
 * Coalesces writes so an in-flight save cannot drop a newer value.
 * `push` returns immediately. Closing the page can drop a write that has not been sent.
 */
export function createLatestSaveQueue<T>(
  save: (value: T) => Promise<void>,
  options: LatestSaveQueueOptions<T> = {}
): LatestSaveQueue<T> {
  const attempts = options.attempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 0;
  let saving = false;
  let scheduled = false;
  let pending: { value: T } | undefined;
  let idleWaiters: Array<() => void> = [];

  function releaseIdle() {
    if (saving || pending) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }

  async function write(value: T): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (pending) return;
      try {
        await save(value);
        if (!pending) options.onSuccess?.(value);
        return;
      } catch (error) {
        if (pending) return;
        if (attempt === attempts) {
          options.onError?.(error);
          return;
        }
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }
  }

  async function flush(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      while (pending) {
        const value = pending.value;
        pending = undefined;
        await write(value);
      }
    } finally {
      saving = false;
      if (pending) void flush();
      else releaseIdle();
    }
  }

  return {
    push(value: T) {
      pending = { value };
      if (scheduled || saving) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void flush();
      });
    },
    whenIdle() {
      if (!saving && !pending) return Promise.resolve();
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
}
