import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET — listar transacoes do mes
async function handleGet(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // ex: 2026-05

  let query = "SELECT * FROM transactions WHERE user_id = ?";
  const params: string[] = [userId];

  if (month) {
    query += " AND entry_date LIKE ?";
    params.push(`${month}%`);
  }

  query += " ORDER BY entry_date DESC";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse({ transactions: results || [] });
}

// POST — criar transacao
async function handlePost(request: Request, env: Env, userId: string) {
  const body = await request.json();

  if (!body.description?.trim() || !body.entry_date || !body.amount_cents) {
    return errorResponse("Descricao, data e valor obrigatorios");
  }

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
    `INSERT INTO transactions
      (id, user_id, type, description, amount_cents, entry_date, category_id, notes, source_recurring_id, source_month, is_paid, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
  ).bind(
    id,
    userId,
    body.type || "saida",
    body.description.trim(),
    body.amount_cents,
    body.entry_date,
    body.category_id || null,
    body.notes || null,
    body.source_recurring_id || null,
    body.source_month || null,
    body.is_paid ? 1 : 0
  ).run();

  const row = await env.DB.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_paid: Boolean(row?.is_paid) } }, 201);
}

// PUT — atualizar transacao
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
    `UPDATE transactions SET
      type = ?, description = ?, amount_cents = ?, entry_date = ?,
      category_id = ?, notes = ?, is_paid = ?
     WHERE id = ? AND user_id = ?`
  ).bind(
    body.type,
    body.description.trim(),
    body.amount_cents,
    body.entry_date,
    body.category_id || null,
    body.notes || null,
    body.is_paid ? 1 : 0,
    id,
    userId
  ).run();

  const row = await env.DB.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_paid: Boolean(row?.is_paid) } });
}

// DELETE
async function handleDelete(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  await env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return jsonResponse({ success: true });
}

// PATCH — toggle paid
async function handlePatch(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("ID obrigatorio");

  const body = await request.json() as { is_paid: boolean };

  await env.DB.prepare(
    "UPDATE transactions SET is_paid = ? WHERE id = ? AND user_id = ?"
  ).bind(body.is_paid ? 1 : 0, id, userId).run();

  const row = await env.DB.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return jsonResponse({ data: { ...row, is_paid: Boolean(row?.is_paid) } });
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = await getAuthUser(request, env.JWT_SECRET);
  if (!auth) return unauthorizedResponse();

  if (request.method === "GET") return handleGet(request, env, auth.userId);
  if (request.method === "POST") return handlePost(request, env, auth.userId);
  if (request.method === "PUT") return handlePut(request, env, auth.userId);
  if (request.method === "DELETE") return handleDelete(request, env, auth.userId);
  if (request.method === "PATCH") return handlePatch(request, env, auth.userId);
  return errorResponse("Metodo nao suportado", 405);
};
