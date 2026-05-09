const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.reload();
    return null;
  }

  const data = response.status !== 204 ? await response.json() : null;

  if (!response.ok) {
    return { error: data?.error || `Erro ${response.status}`, status: response.status };
  }

  return data;
}

// Auth
export const authApi = {
  register: (username: string, password: string) =>
    fetchApi("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),

  login: (username: string, password: string) =>
    fetchApi("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  refresh: () => fetchApi("/auth/refresh"),
};

// Profile
export const profileApi = {
  get: () => fetchApi("/profile"),
  update: (data: { display_name?: string; password?: string }) =>
    fetchApi("/profile", { method: "PUT", body: JSON.stringify(data) }),
};

// Categories
export const categoriesApi = {
  list: () => fetchApi("/categories"),
  create: (data: { name: string; type: string; color: string }) =>
    fetchApi("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; color: string }) =>
    fetchApi(`/categories?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi(`/categories?id=${id}`, { method: "DELETE" }),
};

// Transactions
export const transactionsApi = {
  list: (month?: string) => fetchApi(`/transactions${month ? `?month=${month}` : ""}`),
  create: (data: Record<string, unknown>) =>
    fetchApi("/transactions", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/transactions?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi(`/transactions?id=${id}`, { method: "DELETE" }),
  togglePaid: (id: string, isPaid: boolean) =>
    fetchApi(`/transactions?id=${id}`, { method: "PATCH", body: JSON.stringify({ is_paid: isPaid }) }),
};

// Recurring
export const recurringApi = {
  list: () => fetchApi("/recurring"),
  create: (data: Record<string, unknown>) =>
    fetchApi("/recurring", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/recurring?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi(`/recurring?id=${id}`, { method: "DELETE" }),
  toggleActive: (id: string, isActive: boolean) =>
    fetchApi(`/recurring?id=${id}`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) }),
};

// Limits
export const limitsApi = {
  list: () => fetchApi("/limits"),
  upsert: (data: { category_id: string; amount_cents: number }) =>
    fetchApi("/limits", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi(`/limits?id=${id}`, { method: "DELETE" }),
};

// Dashboard
export const dashboardApi = {
  load: (month?: string) => fetchApi(`/dashboard${month ? `?month=${month}` : ""}`),
};
