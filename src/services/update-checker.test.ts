import { describe, it, expect, vi, afterEach } from "vitest";
import { checkForUpdate, isUpdateCheckDisabled, runUpdateNotification } from "./update-checker.js";
import { logger } from "./logger.js";

describe("checkForUpdate", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetchResponse(body: unknown, ok = true): void {
    global.fetch = vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    } as Response);
  }

  it("returns updateAvailable=true when latest is newer", async () => {
    mockFetchResponse({ version: "2.0.2" });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info).toEqual({
      current: "2.0.1",
      latest: "2.0.2",
      updateAvailable: true,
      releaseUrl: "https://www.npmjs.com/package/x/v/2.0.2",
    });
  });

  it("returns updateAvailable=false when latest equals current", async () => {
    mockFetchResponse({ version: "2.0.1" });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info?.updateAvailable).toBe(false);
  });

  it("returns updateAvailable=false when latest is older (e.g. local dev build)", async () => {
    mockFetchResponse({ version: "1.9.9" });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info?.updateAvailable).toBe(false);
  });

  it("handles minor and major bumps correctly", async () => {
    mockFetchResponse({ version: "2.1.0" });
    const minor = await checkForUpdate({ currentVersion: "2.0.5", packageName: "x" });
    expect(minor?.updateAvailable).toBe(true);

    mockFetchResponse({ version: "3.0.0" });
    const major = await checkForUpdate({ currentVersion: "2.9.9", packageName: "x" });
    expect(major?.updateAvailable).toBe(true);
  });

  it("strips prerelease suffix when comparing", async () => {
    mockFetchResponse({ version: "2.0.2-rc.1" });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info?.updateAvailable).toBe(true);
  });

  it("returns null on non-2xx response", async () => {
    mockFetchResponse({}, false);
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info).toBeNull();
  });

  it("returns null on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info).toBeNull();
  });

  it("returns null when response has no version field", async () => {
    mockFetchResponse({});
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info).toBeNull();
  });

  it("returns null when response version is not a string", async () => {
    mockFetchResponse({ version: 42 });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info).toBeNull();
  });

  it("returns null when timeout elapses", async () => {
    global.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
        })
    );
    const info = await checkForUpdate({
      currentVersion: "2.0.1",
      packageName: "x",
      timeoutMs: 10,
    });
    expect(info).toBeNull();
  });

  it("does not throw on malformed semver in the registry response", async () => {
    mockFetchResponse({ version: "garbage" });
    const info = await checkForUpdate({ currentVersion: "2.0.1", packageName: "x" });
    expect(info?.updateAvailable).toBe(false);
  });
});

describe("isUpdateCheckDisabled", () => {
  const originalEnv = process.env["BOOND_DISABLE_UPDATE_CHECK"];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env["BOOND_DISABLE_UPDATE_CHECK"];
    else process.env["BOOND_DISABLE_UPDATE_CHECK"] = originalEnv;
  });

  it("returns false when the var is unset", () => {
    delete process.env["BOOND_DISABLE_UPDATE_CHECK"];
    expect(isUpdateCheckDisabled()).toBe(false);
  });

  it.each(["1", "true", "TRUE", "yes", " Yes "])("returns true for %s", (value) => {
    process.env["BOOND_DISABLE_UPDATE_CHECK"] = value;
    expect(isUpdateCheckDisabled()).toBe(true);
  });

  it.each(["0", "false", "no", "", "anything"])("returns false for %s", (value) => {
    process.env["BOOND_DISABLE_UPDATE_CHECK"] = value;
    expect(isUpdateCheckDisabled()).toBe(false);
  });
});

describe("runUpdateNotification", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env["BOOND_DISABLE_UPDATE_CHECK"];

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env["BOOND_DISABLE_UPDATE_CHECK"];
    else process.env["BOOND_DISABLE_UPDATE_CHECK"] = originalEnv;
    vi.restoreAllMocks();
  });

  it("logs a warning when an update is available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "9.9.9" }),
    } as Response);
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined as unknown as void);
    await runUpdateNotification({ currentVersion: "0.0.1", packageName: "x" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [meta] = warnSpy.mock.calls[0]!;
    expect(meta).toMatchObject({ event: "update_available", current: "0.0.1", latest: "9.9.9" });
  });

  it("does not log when no update is available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "0.0.1" }),
    } as Response);
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined as unknown as void);
    await runUpdateNotification({ currentVersion: "0.0.1", packageName: "x" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("skips the check entirely when disabled via env", async () => {
    process.env["BOOND_DISABLE_UPDATE_CHECK"] = "true";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    await runUpdateNotification({ currentVersion: "0.0.1", packageName: "x" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws on registry failures", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("DNS failure"));
    await expect(runUpdateNotification({ currentVersion: "0.0.1", packageName: "x" })).resolves.toBeUndefined();
  });
});
