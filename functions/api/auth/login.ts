import bcryptjs from "bcryptjs";
import { signToken, jsonResponse, errorResponse, checkRateLimit } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const rateLimit = checkRateLimit(request);
  if (rateLimit) return rateLimit;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return errorResponse("Usuario e senha obrigatorios.");
    }

    const user = await env.DB.prepare(
      "SELECT id, username, password_hash, display_name FROM users WHERE username = ?"
    ).bind(username.toLowerCase()).first<{ id: string; username: string; password_hash: string; display_name: string | null }>();

    if (!user) {
      return errorResponse("Usuario ou senha incorretos.", 401);
    }

    const valid = await bcryptjs.compare(password, user.password_hash);
    if (!valid) {
      return errorResponse("Usuario ou senha incorretos.", 401);
    }

    const token = await signToken({ userId: user.id, email: user.username }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name },
    });
  } catch (err: any) {
    return errorResponse(err.message || "Nao foi possivel entrar.", 500);
  }
};
