import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: mockLookup,
  },
}));

describe("plugin-host-http", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  it("rejects loopback and localhost targets", async () => {
    const { validateAndResolveFetchUrl } = await import("../services/plugin-host-http.js");

    await expect(validateAndResolveFetchUrl("http://localhost:3100")).rejects.toThrow(/private or loopback/i);
    await expect(validateAndResolveFetchUrl("http://127.0.0.1:3100")).rejects.toThrow(/private or loopback/i);
  });

  it("rejects hostnames with any private DNS answer", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    const { validateAndResolveFetchUrl } = await import("../services/plugin-host-http.js");

    await expect(validateAndResolveFetchUrl("https://mixed.example")).rejects.toThrow(/private or loopback/i);
  });

  it("allows hostnames that resolve only to public addresses", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const { validateAndResolveFetchUrl } = await import("../services/plugin-host-http.js");

    await expect(validateAndResolveFetchUrl("https://public.example/path")).resolves.toMatchObject({
      address: "93.184.216.34",
      family: 4,
    });
  });
});
