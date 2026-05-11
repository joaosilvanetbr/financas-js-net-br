import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/profile — dados do perfil
async function handleGet(env: Env, userId: string) {
  const row = await env.DB.prepare(
    "SELECT id, username, display_name, created_at FROM users WHERE id = ?"
  ).bind(userId).first<{ id: string; username: string; display_name: string | null; created_at: number }>();

  if (!row) return errorResponse("Perfil nao encontrado", 404);

  return jsonResponse({
    id: row.id,
    username: row.username,
    display_name: row.display_name,
  });
}

// PUT /api/profile — atualizar perfil
async function handlePut(request: Request, env: Env, userId: string) {
  const body = await request.json() as { display_name?: string; username?: string; password?: string };

  if (body.display_name !== undefined) {
    await env.DB.prepare(
      "UPDATE users SET display_name = ? WHERE id = ?"
    ).bind(body.display_name || null, userId).run();
  }

  if (body.username) {
    const lowerUsername = body.username.toLowerCase();
    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?").bind(lowerUsername, userId).first();
    if (existing) {
      return errorResponse("Este usuario ja esta em uso.");
    }
    await env.DB.prepare(
      "UPDATE users SET username = ? WHERE id = ?"
    ).bind(lowerUsername, userId).run();
  }

  if (body.password) {
    const bcryptjs = await import("bcryptjs");
    const hash = await bcryptjs.hash(body.password, 10);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(hash, userId).run();
  }

  return handleGet(env, userId);
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = await getAuthUser(request, env.JWT_SECRET);
  if (!auth) return unauthorizedResponse();

  if (request.method === "GET") return handleGet(env, auth.userId);
  if (request.method === "PUT") return handlePut(request, env, auth.userId);
  return errorResponse("Metodo nao suportado", 405);
};
