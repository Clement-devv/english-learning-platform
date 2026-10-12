import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = { role: null, token: null };
vi.mock("./AuthContext.jsx", () => ({ useAuth: () => auth }));

const get = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock("../api.js", () => ({
  default: { get: (...a) => get(...a), post: vi.fn(() => Promise.resolve({ data: {} })) },
  refreshToken: vi.fn(() => Promise.resolve(null)),
  tokenExpiresSoon: () => false,
}));

const io = vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn() }));
vi.mock("socket.io-client", () => ({ io: (...a) => io(...a) }));

const { RingProvider } = await import("./RingContext.jsx");

describe("RingProvider", () => {
  beforeEach(() => {
    get.mockClear(); io.mockClear();
    sessionStorage.clear(); localStorage.clear();
    auth.role = null; auth.token = null;
  });

  it("does nothing for the super admin (their token has no center)", () => {
    localStorage.setItem("superAdminToken", "sa.token.x");
    auth.role = "super-admin"; auth.token = "sa.token.x";
    render(<RingProvider><div /></RingProvider>);
    expect(get).not.toHaveBeenCalled();
    expect(io).not.toHaveBeenCalled();
  });

  it("starts ring + chat for a sub-admin", () => {
    sessionStorage.setItem("subAdminToken", "sub.token.x");
    auth.role = "sub-admin"; auth.token = "sub.token.x";
    render(<RingProvider><div /></RingProvider>);
    const urls = get.mock.calls.map(([u]) => u);
    expect(urls).toEqual(expect.arrayContaining(["/ring/alerts-seen", "/ring/missed-calls"]));
    expect(io).toHaveBeenCalled();
  });
});
