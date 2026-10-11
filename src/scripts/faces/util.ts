/**
 * Yields to the event loop so the page can paint and handle input. Uses
 * scheduler.yield() when available, else a MessageChannel task (which, unlike
 * setTimeout, is not throttled in background tabs).
 */
export function yieldToUI(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
