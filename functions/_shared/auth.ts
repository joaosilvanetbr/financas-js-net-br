import { SignJWT, jwtVerify } from "jose";

export async function signToken(payload: { userId: string; email: string }, secret: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { clockTolerance: 60 });
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export function getAuthUser(request: Request, jwtSecret: string) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7), jwtSecret);
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function unauthorizedResponse() {
  return errorResponse("Nao autorizado", 401);
}

// --- Rate Limiting (in-memory, por instancia Worker) ---
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

function getClientIP(request: Request): string {
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")
    || "unknown";
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(key);
  }
}

export function checkRateLimit(request: Request): Response | null {
  cleanupExpired();
  const ip = getClientIP(request);
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return errorResponse(
      `Muitas tentativas. Aguarde ${Math.ceil((entry.resetAt - now) / 60000)} minutos.`,
      429
    );
  }

  entry.count++;
  return null;
}
