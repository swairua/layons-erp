// Safe ResizeObserver utility that prevents loops and handles errors gracefully

interface SafeResizeObserverCallback {
  (entries: ResizeObserverEntry[]): void;
}

export class SafeResizeObserver {
  private observer: ResizeObserver | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private isObserving = false;
  private debounceMs: number;
  private callback: SafeResizeObserverCallback;
  private lastEntries: ResizeObserverEntry[] | null = null;

  constructor(callback: SafeResizeObserverCallback, debounceMs = 250) {
    this.callback = callback;
    this.debounceMs = debounceMs;

    try {
      // Suppress any ResizeObserver errors during creation by wrapping with error handling
      this.observer = new ResizeObserver((entries) => {
        this.handleResize(entries);
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('ResizeObserver not supported, falling back gracefully');
      }
      this.observer = null;
    }
  }

  private handleResize = (entries: ResizeObserverEntry[]) => {
    // Store entries reference to prevent mutation issues
    this.lastEntries = entries;

    // Clear any pending callback
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Debounce the callback to prevent loops
    // Use a longer debounce to ensure layout stabilization
    this.timeoutId = setTimeout(() => {
      try {
        if (!this.lastEntries) return;

        // Use requestAnimationFrame to ensure we're not in a layout cycle
        requestAnimationFrame(() => {
          try {
            if (this.lastEntries) {
              this.callback(this.lastEntries);
            }
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.debug('SafeResizeObserver callback error:', err);
            }
          }
        });
      } catch (error) {
        // Silently handle errors to prevent console spam
        if (process.env.NODE_ENV === 'development') {
          console.debug('SafeResizeObserver error:', error);
        }
      }
    }, this.debounceMs);
  };

  observe(target: Element): void {
    if (!this.observer || this.isObserving) return;

    try {
      this.observer.observe(target);
      this.isObserving = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to observe element:', error);
      }
    }
  }

  unobserve(target: Element): void {
    if (!this.observer) return;

    try {
      this.observer.unobserve(target);
      this.isObserving = false;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to unobserve element:', error);
      }
    }
  }

  disconnect(): void {
    if (this.observer) {
      try {
        this.observer.disconnect();
        this.isObserving = false;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Failed to disconnect observer:', error);
        }
      }
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.lastEntries = null;
  }
}

// Convenience function to create a safe ResizeObserver
export const createSafeResizeObserver = (
  callback: SafeResizeObserverCallback,
  debounceMs = 250
): SafeResizeObserver => {
  return new SafeResizeObserver(callback, debounceMs);
};
