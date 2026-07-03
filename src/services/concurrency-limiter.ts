/**
 * Concurrency limiter (counting semaphore) for the BoondManager HTTP client.
 *
 * Why a semaphore *in addition to* the token bucket (rate-limiter.ts):
 *   - The token bucket limits *throughput* (requests per second). It does NOT
 *     limit *concurrency* — with a burst capacity of 20, sixteen parallel tool
 *     calls all acquire a token instantly and hit the API simultaneously,
 *     stampeding BoondManager into 429s and (in stateless HTTP mode) spiking
 *     the process with many McpServer instances at once.
 *   - This semaphore caps how many requests are *in flight at the same time*.
 *     Excess callers wait for a slot rather than firing immediately, so a wide
 *     parallel salvo is flattened into a sliding window of N concurrent calls.
 *
 * Behaviour notes:
 *   - `acquire()` resolves to a `release` function, meant for `try/finally`.
 *   - There is no idle "pause": as soon as one in-flight call finishes, its slot
 *     is handed directly to the next waiter (FIFO), so exactly N calls run while
 *     work remains.
 *   - `release` is idempotent — calling it twice (or from a finally after an
 *     error) is a no-op the second time and never over-releases the semaphore.
 */

export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(public readonly capacity: number) {
    if (!(capacity > 0)) throw new Error("Semaphore: capacity must be > 0");
    this.available = capacity;
  }

  /** Wait for a free slot, then occupy it. Resolves to the matching release fn. */
  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return this.makeRelease();
    }
    // No slot free — queue up. release() will hand a held slot straight to us,
    // so we must NOT decrement `available` again when resumed.
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    return this.makeRelease();
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) {
        // Pass the slot straight to the next waiter — never let `available`
        // tick up and back down, which would open a race for the free slot.
        next();
      } else {
        this.available += 1;
      }
    };
  }

  /** Number of slots currently occupied. Visible for tests/observability. */
  inFlight(): number {
    return this.capacity - this.available;
  }

  /** Number of callers queued waiting for a slot. Visible for tests/observability. */
  waiting(): number {
    return this.waiters.length;
  }
}
