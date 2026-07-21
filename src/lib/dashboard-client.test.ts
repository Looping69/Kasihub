// Author: Klaasvaakie ( |╲ )
import { afterEach, describe, expect, test, vi } from "vitest";
import { invalidateDashboard, loadDashboard } from "./dashboard-client";

afterEach(() => {
  invalidateDashboard("profile-1");
  vi.unstubAllGlobals();
});

describe("dashboard request deduplication", () => {
  test("shares one in-flight request between the shell and dashboard view", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalEarnings: 25 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [shell, dashboard] = await Promise.all([
      loadDashboard("profile-1"),
      loadDashboard("profile-1"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(shell).toEqual(dashboard);
    expect(shell.totalEarnings).toBe(25);
  });

  test("evicts failed requests so a retry can recover", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ totalEarnings: 50 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadDashboard("profile-1")).rejects.toThrow("503");
    await expect(loadDashboard("profile-1")).resolves.toMatchObject({ totalEarnings: 50 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
