import { SupabaseClient } from "@supabase/supabase-js";
import {
  Category,
  CategoryLimit,
  defaultCategories,
  getMonthRange,
  RecurringTransaction,
  Transaction,
} from "./finance";

type MaybeDisplayNameError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type DashboardProfile = {
  id: string;
  email: string;
  display_name: string | null;
};

export type DashboardLoadResult = {
  profile: DashboardProfile | null;
  categories: Category[];
  categoryLimits: CategoryLimit[];
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  supportsDisplayName: boolean;
  errors: string[];
};

function isMissingDisplayNameColumn(error: MaybeDisplayNameError | null) {
  if (!error) return false;
  const details = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return details.includes("display_name") || error.code === "PGRST204" || error.code === "42703";
}

function guardClient(client: SupabaseClient | null): asserts client is SupabaseClient {
  if (!client) {
    throw new Error("Supabase não está configurado. Verifique as variáveis de ambiente.");
  }
}

export async function ensureBaseData(client: SupabaseClient, userId: string, email: string) {
  guardClient(client);

  const { error: profileError } = await client.from("profiles").upsert({ id: userId, email });
  if (profileError) {
    throw profileError;
  }

  const { count, error: categoryCountError } = await client
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (categoryCountError) {
    throw categoryCountError;
  }

  if (count === 0) {
    const { error: categoryInsertError } = await client.from("categories").insert(
      defaultCategories.map((item) => ({
        ...item,
        user_id: userId,
      })),
    );
    if (categoryInsertError) {
      throw categoryInsertError;
    }
  }
}

export async function loadDashboardData(
  client: SupabaseClient | null,
  userId: string,
  email: string,
  selectedMonth: string,
  supportsDisplayName: boolean,
): Promise<DashboardLoadResult> {
  guardClient(client);

  await ensureBaseData(client, userId, email);

  const { start, end } = getMonthRange(selectedMonth);

  const [categoryResult, limitResult, transactionResult, recurringResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", userId).order("name"),
    client.from("category_limits").select("id,category_id,amount_cents").eq("user_id", userId),
    client
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("entry_date", start)
      .lt("entry_date", end)
      .order("entry_date", { ascending: false }),
    client.from("recurring_transactions").select("*").eq("user_id", userId).order("day_of_month"),
  ]);

  let profileResult;
  let nextSupportsDisplayName = supportsDisplayName;

  if (supportsDisplayName) {
    profileResult = await client
      .from("profiles")
      .select("id,email,display_name")
      .eq("id", userId)
      .maybeSingle();

    if (isMissingDisplayNameColumn(profileResult.error as MaybeDisplayNameError | null)) {
      nextSupportsDisplayName = false;
      profileResult = await client.from("profiles").select("id,email").eq("id", userId).maybeSingle();
    }
  } else {
    profileResult = await client.from("profiles").select("id,email").eq("id", userId).maybeSingle();
  }

  const errors: string[] = [];
  if (profileResult.error) errors.push("Erro ao carregar perfil.");
  if (categoryResult.error) errors.push("Erro ao carregar categorias.");
  if (limitResult.error) errors.push("Erro ao carregar limites.");
  if (transactionResult.error) errors.push("Erro ao carregar lançamentos.");
  if (recurringResult.error) errors.push("Erro ao carregar recorrências.");

  const profileRow = profileResult.data as
    | {
        id: string;
        email: string;
        display_name?: string | null;
      }
    | null;

  return {
    profile: profileRow
      ? {
          id: profileRow.id,
          email: profileRow.email,
          display_name: profileRow.display_name ?? null,
        }
      : null,
    categories: categoryResult.data ?? [],
    categoryLimits: limitResult.data ?? [],
    transactions: transactionResult.data ?? [],
    recurring: recurringResult.data ?? [],
    supportsDisplayName: nextSupportsDisplayName,
    errors,
  };
}

export async function createTransaction(
  client: SupabaseClient | null,
  payload: Omit<Transaction, "id"> & { user_id: string },
) {
  guardClient(client);
  return client.from("transactions").insert(payload).select("*").single();
}

export async function updateTransactionById(
  client: SupabaseClient | null,
  id: string,
  userId: string,
  payload: Partial<Transaction>,
) {
  guardClient(client);
  return client
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function deleteTransactionById(client: SupabaseClient | null, id: string, userId: string) {
  guardClient(client);
  return client.from("transactions").delete().eq("id", id).eq("user_id", userId);
}

export async function createCategory(
  client: SupabaseClient | null,
  payload: { user_id: string; name: string; type: Category["type"]; color: string },
) {
  guardClient(client);
  return client.from("categories").insert(payload).select("*").single();
}

export async function updateCategoryById(
  client: SupabaseClient | null,
  id: string,
  userId: string,
  payload: Pick<Category, "name" | "color">,
) {
  guardClient(client);
  return client.from("categories").update(payload).eq("id", id).eq("user_id", userId).select("*").single();
}

export async function deleteCategoryById(client: SupabaseClient | null, id: string, userId: string) {
  guardClient(client);
  return client.from("categories").delete().eq("id", id).eq("user_id", userId);
}

export async function upsertCategoryLimit(
  client: SupabaseClient | null,
  payload: { user_id: string; category_id: string; amount_cents: number; updated_at: string },
) {
  guardClient(client);
  return client
    .from("category_limits")
    .upsert(payload, { onConflict: "user_id,category_id" })
    .select("id,category_id,amount_cents")
    .single();
}

export async function deleteCategoryLimitById(client: SupabaseClient | null, id: string, userId: string) {
  guardClient(client);
  return client.from("category_limits").delete().eq("id", id).eq("user_id", userId);
}

export async function createRecurringTransaction(
  client: SupabaseClient | null,
  payload: { user_id: string } & Omit<RecurringTransaction, "id">,
) {
  guardClient(client);
  return client.from("recurring_transactions").insert(payload).select("*").single();
}

export async function updateRecurringTransactionById(
  client: SupabaseClient | null,
  id: string,
  userId: string,
  payload: Omit<RecurringTransaction, "id">,
) {
  guardClient(client);
  return client
    .from("recurring_transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function deleteRecurringTransactionById(client: SupabaseClient | null, id: string, userId: string) {
  guardClient(client);
  return client.from("recurring_transactions").delete().eq("id", id).eq("user_id", userId);
}

export async function updateRecurringActiveState(
  client: SupabaseClient | null,
  id: string,
  userId: string,
  isActive: boolean,
) {
  guardClient(client);
  return client
    .from("recurring_transactions")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function updateTransactionPaidState(
  client: SupabaseClient | null,
  id: string,
  userId: string,
  isPaid: boolean,
) {
  guardClient(client);
  return client
    .from("transactions")
    .update({ is_paid: isPaid })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function updateProfileDisplayName(
  client: SupabaseClient | null,
  userId: string,
  email: string,
  displayName: string | null,
) {
  guardClient(client);
  return client.from("profiles").update({ display_name: displayName, email }).eq("id", userId);
}
