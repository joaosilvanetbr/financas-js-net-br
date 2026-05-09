import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET_KEY = () => {
  const secret = (globalThis as any).env?.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET nao configurado");
  return new TextEncoder().encode(secret);
};

export async function signToken(payload: { userId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET_KEY());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY(), { clockTolerance: 60 });
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export function getAuthUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
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
