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
