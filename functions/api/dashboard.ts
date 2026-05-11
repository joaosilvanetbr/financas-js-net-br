import { getAuthUser, jsonResponse, unauthorizedResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = await getAuthUser(request, env.JWT_SECRET);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month");
    const userId = auth.userId;

    // Perfil
    const profile = await env.DB.prepare(
      "SELECT id, username, display_name FROM users WHERE id = ?"
    ).bind(userId).first();

    // Categorias
    const { results: categories } = await env.DB.prepare(
      "SELECT * FROM categories WHERE user_id = ? ORDER BY name"
    ).bind(userId).all();

    // Limites
    const { results: limits } = await env.DB.prepare(
      "SELECT * FROM category_limits WHERE user_id = ? ORDER BY created_at"
    ).bind(userId).all();

    // Transacoes do mes
    const monthFilter = month ? `${month}%` : `${new Date().toISOString().slice(0, 7)}%`;
    const { results: transactions } = await env.DB.prepare(
      "SELECT * FROM transactions WHERE user_id = ? AND entry_date LIKE ? ORDER BY entry_date DESC"
    ).bind(userId, monthFilter).all();

    // Recorrencias
    const { results: recurring } = await env.DB.prepare(
      "SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY day_of_month"
    ).bind(userId).all();

    return jsonResponse({
      profile,
      categories: categories || [],
      categoryLimits: limits || [],
      transactions: (transactions || []).map((t: any) => ({ ...t, is_paid: Boolean(t.is_paid) })),
      recurring: (recurring || []).map((r: any) => ({ ...r, is_active: Boolean(r.is_active) })),
    });
  } catch (err: any) {
    return errorResponse(err.message || "Erro ao carregar dashboard", 500);
  }
};
