import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET
async function handleGet(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM category_limits WHERE user_id = ? ORDER BY created_at"
  ).bind(userId).all();

  return jsonResponse({ limits: results || [] });
}

// POST/UPSERT
async function handlePost(request: Request, env: Env, userId: string) {
  const body = await request.json();

  // Verifica se ja existe
  const existing = await env.DB.prepare(
    "SELECT id FROM category_limits WHERE user_id = ? AND category_id = ?"
  ).bind(userId, body.category_id).first<{ id: string }>();

  if (existing) {
    // Update
    await env.DB.prepare(
      "UPDATE category_limits SET amount_cents = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?"
    ).bind(body.amount_cents, existing.id, userId).run();

    const row = await env.DB.prepare("SELECT * FROM category_limits WHERE id = ?").bind(existing.id).first();
    return jsonResponse({ data: row });
  } else {
    // Insert
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO category_limits (id, user_id, category_id, amount_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`
    ).bind(id, userId, body.category_id, body.amount_cents).run();

    const row = await env.DB.prepare("SELECT * FROM category_limits WHERE id = ?").bind(id).first();
    return jsonResponse({ data: row }, 201);
  }
}

// DELETE
async function handleDelete(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  await env.DB.prepare("DELETE FROM category_limits WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return jsonResponse({ success: true });
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  (globalThis as any).env = env;
  const auth = await getAuthUser(request);
  if (!auth) return unauthorizedResponse();

  if (request.method === "GET") return handleGet(env, auth.userId);
  if (request.method === "POST") return handlePost(request, env, auth.userId);
  if (request.method === "DELETE") return handleDelete(request, env, auth.userId);
  return errorResponse("Metodo nao suportado", 405);
};
