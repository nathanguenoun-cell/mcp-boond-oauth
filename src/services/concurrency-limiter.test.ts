import { describe, it, expect } from "vitest";
import { Semaphore } from "./concurrency-limiter.js";

/** Drain pending microtasks so queued acquires can resume before assertions. */
async function flushMicrotasks(rounds = 20) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

describe("Semaphore", () => {
  it("rejects non-positive capacity", () => {
    expect(() => new Semaphore(0)).toThrow(/capacity must be > 0/);
    expect(() => new Semaphore(-1)).toThrow(/capacity must be > 0/);
  });

  it("acquires immediately while slots are free", async () => {
    const sem = new Semaphore(2);
    expect(sem.inFlight()).toBe(0);

    await sem.acquire();
    expect(sem.inFlight()).toBe(1);

    await sem.acquire();
    expect(sem.inFlight()).toBe(2);
    expect(sem.waiting()).toBe(0);
  });

  it("blocks the next acquire once full, until a slot is released", async () => {
    const sem = new Semaphore(1);
    const release1 = await sem.acquire();
    expect(sem.inFlight()).toBe(1);

    let acquired = false;
    const pending = sem.acquire().then((r) => {
      acquired = true;
      return r;
    });

    await flushMicrotasks();
    expect(acquired).toBe(false); // still blocked — no free slot
    expect(sem.waiting()).toBe(1);
    expect(sem.inFlight()).toBe(1);

    release1();
    await flushMicrotasks();
    expect(acquired).toBe(true); // slot handed to the waiter
    expect(sem.waiting()).toBe(0);
    expect(sem.inFlight()).toBe(1);

    (await pending)();
    expect(sem.inFlight()).toBe(0);
  });

  it("hands released slots to waiters in FIFO order", async () => {
    const sem = new Semaphore(1);
    const release0 = await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then((r) => {
      order.push(1);
      return r;
    });
    const p2 = sem.acquire().then((r) => {
      order.push(2);
      return r;
    });

    await flushMicrotasks();
    expect(order).toEqual([]);
    expect(sem.waiting()).toBe(2);

    release0();
    await flushMicrotasks();
    expect(order).toEqual([1]); // first waiter served first

    (await p1)();
    await flushMicrotasks();
    expect(order).toEqual([1, 2]); // then the second

    (await p2)();
    expect(sem.inFlight()).toBe(0);
  });

  it("has an idempotent release (double-call is a no-op)", async () => {
    const sem = new Semaphore(2);
    const release = await sem.acquire();
    expect(sem.inFlight()).toBe(1);

    release();
    expect(sem.inFlight()).toBe(0);

    release(); // must not over-release below zero in-flight
    expect(sem.inFlight()).toBe(0);
  });

  it("does not over-release a slot when release is called twice with a waiter queued", async () => {
    const sem = new Semaphore(1);
    const release = await sem.acquire();

    let served = 0;
    const p = sem.acquire().then((r) => {
      served++;
      return r;
    });

    release();
    release(); // second call must be ignored, not free an extra slot
    await flushMicrotasks();

    expect(served).toBe(1);
    expect(sem.inFlight()).toBe(1);
    (await p)();
    expect(sem.inFlight()).toBe(0);
  });
});
