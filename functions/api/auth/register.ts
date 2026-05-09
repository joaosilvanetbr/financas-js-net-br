import bcryptjs from "bcryptjs";
import { signToken, jsonResponse, errorResponse } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  (globalThis as any).env = env;

  try {
    const { username, password } = await request.json();

    if (!username || !password || password.length < 6) {
      return errorResponse("Usuario e senha obrigatorios. Senha minimo 6 caracteres.");
    }

    if (username.length < 3 || username.length > 30) {
      return errorResponse("Usuario deve ter entre 3 e 30 caracteres.");
    }

    // Verificar se username ja existe
    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username.toLowerCase()).first();
    if (existing) {
      return errorResponse("Este usuario ja esta em uso.");
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    const id = crypto.randomUUID();

    await env.DB.prepare(
      "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, unixepoch())"
    ).bind(id, username.toLowerCase(), passwordHash).run();

    const token = await signToken({ userId: id, email: username.toLowerCase() });

    return jsonResponse({ token, user: { id, username: username.toLowerCase() } });
  } catch {
    return errorResponse("Nao foi possivel criar a conta.", 500);
  }
};
