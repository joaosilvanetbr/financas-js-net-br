import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET — listar categorias
async function handleGet(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, type, color, created_at FROM categories WHERE user_id = ? ORDER BY name"
  ).bind(userId).all<{ id: string; name: string; type: string; color: string; created_at: number }>();

  return jsonResponse({ categories: results || [] });
}

// POST — criar categoria
async function handlePost(request: Request, env: Env, userId: string) {
  const body = await request.json() as { name: string; type: string; color: string };

  if (!body.name?.trim() || !body.type) {
    return errorResponse("Nome e tipo obrigatorios");
  }

  if (body.type !== "entrada" && body.type !== "saida") {
    return errorResponse("Tipo deve ser 'entrada' ou 'saida'", 400);
  }

  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      "INSERT INTO categories (id, user_id, name, type, color, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())"
    ).bind(id, userId, body.name.trim(), body.type, body.color || "#1971c2").run();

    const row = await env.DB.prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?").bind(id, userId).first();
    return jsonResponse({ data: row }, 201);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      return errorResponse("Ja existe uma categoria com esse nome neste grupo");
    }
    return errorResponse("Erro ao criar categoria", 500);
  }
}

// PUT — atualizar categoria
async function handlePut(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  const body = await request.json() as { name: string; color: string };

  try {
    await env.DB.prepare(
      "UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?"
    ).bind(body.name.trim(), body.color, id, userId).run();

    const row = await env.DB.prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?").bind(id, userId).first();
    return jsonResponse({ data: row });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      return errorResponse("Ja existe uma categoria com esse nome neste grupo");
    }
    return errorResponse("Erro ao atualizar categoria", 500);
  }
}

// DELETE — remover categoria
async function handleDelete(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?").bind(id, userId),
    env.DB.prepare("DELETE FROM category_limits WHERE category_id = ? AND user_id = ?").bind(id, userId),
    env.DB.prepare("UPDATE transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?").bind(id, userId),
    env.DB.prepare("UPDATE recurring_transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?").bind(id, userId),
  ]);

  return jsonResponse({ success: true });
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = await getAuthUser(request, env.JWT_SECRET);
  if (!auth) return unauthorizedResponse();

  if (request.method === "GET") return handleGet(env, auth.userId);
  if (request.method === "POST") return handlePost(request, env, auth.userId);
  if (request.method === "PUT") return handlePut(request, env, auth.userId);
  if (request.method === "DELETE") return handleDelete(request, env, auth.userId);
  return errorResponse("Metodo nao suportado", 405);
};
