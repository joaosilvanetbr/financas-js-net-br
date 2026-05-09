import { getAuthUser, jsonResponse, unauthorizedResponse } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  (globalThis as any).env = env;

  const auth = await getAuthUser(request);
  if (!auth) return unauthorizedResponse();

  const user = await env.DB.prepare(
    "SELECT id, username, display_name FROM users WHERE id = ?"
  ).bind(auth.userId).first<{ id: string; username: string; display_name: string | null }>();

  if (!user) return unauthorizedResponse();

  return jsonResponse({ user });
};
