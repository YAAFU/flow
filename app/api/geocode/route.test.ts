import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/geocode/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reverse geocoding privacy contract", () => {
  it("rejects missing coordinates without calling the provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(new NextRequest("http://localhost/api/geocode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts coordinates in a JSON body and applies a provider timeout", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ name: "อโศก" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(new NextRequest("http://localhost/api/geocode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ latitude: 13.7367, longitude: 100.5601 }),
    }));

    expect(await response.json()).toMatchObject({ name: "อโศก", lat: 13.7367, lng: 100.5601 });
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const providerUrl = fetcher.mock.calls[0]?.[0];
    expect(providerUrl).toBeInstanceOf(URL);
    if (!(providerUrl instanceof URL)) throw new Error("expected provider URL");
    expect(providerUrl.hostname).toBe("nominatim.openstreetmap.org");
    expect(providerUrl.searchParams.get("lat")).toBe("13.7367");
    expect(providerUrl.searchParams.get("lon")).toBe("100.5601");
  });
});
