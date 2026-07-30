import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/route/route";
import { durationTable, roadRoute } from "@/lib/osrm";

vi.mock("@/lib/osrm", () => ({
  durationTable: vi.fn(),
  roadRoute: vi.fn(),
}));

const durationTableMock = vi.mocked(durationTable);
const roadRouteMock = vi.mocked(roadRoute);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("route API coordinate contract", () => {
  it("does not call a routing provider for fewer than two valid points", async () => {
    const empty = await POST(request({ coords: [], mode: "route" }));
    const single = await POST(request({
      coords: [{ lat: 13.7563, lng: 100.5018 }],
      mode: "route",
    }));

    expect(empty.status).toBe(400);
    expect(single.status).toBe(400);
    expect(roadRouteMock).not.toHaveBeenCalled();
    expect(durationTableMock).not.toHaveBeenCalled();
  });

  it("rejects out-of-range and non-finite coordinates before routing", async () => {
    const response = await POST(request({
      coords: [
        { lat: 13.7563, lng: 100.5018 },
        { lat: 91, lng: 100.52 },
        { lat: "13.74", lng: 100.52 },
      ],
      mode: "route",
    }));

    expect(response.status).toBe(400);
    expect(roadRouteMock).not.toHaveBeenCalled();
  });

  it("routes only after receiving two valid points", async () => {
    roadRouteMock.mockResolvedValue({
      geometry: [[100.5018, 13.7563], [100.5347, 13.7466]],
      legs: [{ durationMin: 12, distanceKm: 4.5 }],
      fallback: false,
    });
    const coords = [
      { lat: 13.7563, lng: 100.5018 },
      { lat: 13.7466, lng: 100.5347 },
    ];

    const response = await POST(request({ coords, mode: "route" }));

    expect(response.status).toBe(200);
    expect(roadRouteMock).toHaveBeenCalledOnce();
    expect(roadRouteMock).toHaveBeenCalledWith(coords);
    expect(durationTableMock).not.toHaveBeenCalled();
  });
});
