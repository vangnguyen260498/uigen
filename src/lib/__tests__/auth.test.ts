// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function signToken(
  payload: object,
  expiresIn: string = "7d"
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession
test("createSession sets an httpOnly cookie with a signed JWT", async () => {
  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, _token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession sets a cookie that expires in ~7 days", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiry = options.expires.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiry).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiry).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// getSession
test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await signToken({
    userId: "user-1",
    email: "user@example.com",
    expiresAt: new Date(),
  });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for a tampered token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await signToken(
    { userId: "user-1", email: "user@example.com", expiresAt: new Date() },
    "-1s"
  );
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

// deleteSession
test("deleteSession removes the auth cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// verifySession
test("verifySession returns null when request has no auth cookie", async () => {
  const request = new Request("http://localhost/api/test") as any;
  request.cookies = { get: () => undefined };

  const session = await verifySession(request);
  expect(session).toBeNull();
});

test("verifySession returns session payload for a valid request token", async () => {
  const token = await signToken({
    userId: "user-2",
    email: "other@example.com",
    expiresAt: new Date(),
  });
  const request = new Request("http://localhost/api/test") as any;
  request.cookies = { get: () => ({ value: token }) };

  const session = await verifySession(request);
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("other@example.com");
});

test("verifySession returns null for an invalid request token", async () => {
  const request = new Request("http://localhost/api/test") as any;
  request.cookies = { get: () => ({ value: "bad.token.here" }) };

  const session = await verifySession(request);
  expect(session).toBeNull();
});
