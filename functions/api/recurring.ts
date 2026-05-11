import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET
async function handleGet(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY day_of_month"
  ).bind(userId).all();

  return jsonResponse({
    recurring: (results || []).map((r: any) => ({ ...r, is_active: Boolean(r.is_active) })),
  });
}

// POST
async function handlePost(request: Request, env: Env, userId: string) {
  const body = await request.json();

  if (body.category_id) {
    const cat = await env.DB.prepare("SELECT 1 FROM categories WHERE id = ? AND user_id = ?")
      .bind(body.category_id, userId).first();
    if (!cat) return errorResponse("Categoria invalida", 400);
  }

  const amount = Number(body.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return errorResponse("Valor deve ser maior que zero", 400);
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO recurring_transactions
      (id, user_id, type, description, amount_cents, category_id, day_of_month, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, unixepoch())`
  ).bind(id, userId, body.type, body.description.trim(), body.amount_cents,
    body.category_id || null, body.day_of_month).run();

  const row = await env.DB.prepare("SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_active: Boolean(row?.is_active) } }, 201);
}

// PUT
async function handlePut(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  const body = await request.json();

  if (body.category_id) {
    const cat = await env.DB.prepare("SELECT 1 FROM categories WHERE id = ? AND user_id = ?")
      .bind(body.category_id, userId).first();
    if (!cat) return errorResponse("Categoria invalida", 400);
  }

  const amount = Number(body.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return errorResponse("Valor deve ser maior que zero", 400);
  }

  await env.DB.prepare(
    `UPDATE recurring_transactions SET
      type = ?, description = ?, amount_cents = ?, category_id = ?,
      day_of_month = ?, is_active = ?
     WHERE id = ? AND user_id = ?`
  ).bind(
    body.type, body.description.trim(), body.amount_cents,
    body.category_id || null, body.day_of_month,
    body.is_active ? 1 : 0, id, userId
  ).run();

  const row = await env.DB.prepare("SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_active: Boolean(row?.is_active) } });
}

// DELETE
async function handleDelete(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  await env.DB.prepare("DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return jsonResponse({ success: true });
}

// PATCH toggle active
async function handlePatch(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  const body = await request.json() as { is_active: boolean };

  await env.DB.prepare(
    "UPDATE recurring_transactions SET is_active = ? WHERE id = ? AND user_id = ?"
  ).bind(body.is_active ? 1 : 0, id, userId).run();

  const row = await env.DB.prepare("SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_active: Boolean(row?.is_active) } });
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = await getAuthUser(request, env.JWT_SECRET);
  if (!auth) return unauthorizedResponse();

  if (request.method === "GET") return handleGet(env, auth.userId);
  if (request.method === "POST") return handlePost(request, env, auth.userId);
  if (request.method === "PUT") return handlePut(request, env, auth.userId);
  if (request.method === "DELETE") return handleDelete(request, env, auth.userId);
  if (request.method === "PATCH") return handlePatch(request, env, auth.userId);
  return errorResponse("Metodo nao suportado", 405);
};
