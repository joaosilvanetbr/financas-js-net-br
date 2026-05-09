import { categoriesApi, dashboardApi, limitsApi, profileApi, recurringApi, transactionsApi } from "./api-client";

export type DashboardProfile = {
  id: string;
  email: string;
  display_name: string | null;
};

export async function loadDashboardData(selectedMonth: string) {
  const monthFilter = selectedMonth;

  // Carrega tudo do endpoint dashboard
  const result: any = await dashboardApi.load(monthFilter);

  if (result?.error) throw new Error(result.error);

  return {
    profile: (result.profile || null) as DashboardProfile | null,
    categories: result.categories || [],
    categoryLimits: result.categoryLimits || [],
    transactions: result.transactions || [],
    recurring: result.recurring || [],
  };
}

// Categorias
export async function createCategory(data: { name: string; type: string; color: string }) {
  return categoriesApi.create(data) as Promise<{ data?: any; error?: any }>;
}

export async function updateCategoryById(id: string, _userId: string, data: { name: string; color: string }) {
  return categoriesApi.update(id, data) as Promise<{ data?: any; error?: any }>;
}

export async function deleteCategoryById(id: string, _userId: string) {
  return categoriesApi.delete(id) as Promise<{ error?: any }>;
}

// Transacoes
export async function createTransaction(data: Record<string, unknown>) {
  return transactionsApi.create(data) as Promise<{ data?: any; error?: any }>;
}

export async function updateTransactionById(id: string, _userId: string, data: Record<string, unknown>) {
  return transactionsApi.update(id, data) as Promise<{ data?: any; error?: any }>;
}

export async function deleteTransactionById(id: string, _userId: string) {
  return transactionsApi.delete(id) as Promise<{ error?: any }>;
}

export async function updateTransactionPaidState(id: string, _userId: string, isPaid: boolean) {
  return transactionsApi.togglePaid(id, isPaid) as Promise<{ data?: any; error?: any }>;
}

// Recorrencias
export async function createRecurringTransaction(data: Record<string, unknown>) {
  return recurringApi.create(data) as Promise<{ data?: any; error?: any }>;
}

export async function updateRecurringTransactionById(id: string, _userId: string, data: Record<string, unknown>) {
  return recurringApi.update(id, data) as Promise<{ data?: any; error?: any }>;
}

export async function deleteRecurringTransactionById(id: string, _userId: string) {
  return recurringApi.delete(id) as Promise<{ error?: any }>;
}

export async function updateRecurringActiveState(id: string, _userId: string, isActive: boolean) {
  return recurringApi.toggleActive(id, isActive) as Promise<{ data?: any; error?: any }>;
}

// Limites
export async function upsertCategoryLimit(data: Record<string, unknown>) {
  return limitsApi.upsert(data as any) as Promise<{ data?: any; error?: any }>;
}

export async function deleteCategoryLimitById(id: string, _userId: string) {
  return limitsApi.delete(id) as Promise<{ error?: any }>;
}

// Profile
export async function updateProfileDisplayName(_userId: string, _email: string, name: string | null) {
  return profileApi.update({ display_name: name || undefined }) as Promise<{ error?: any }>;
}
