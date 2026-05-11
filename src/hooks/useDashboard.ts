import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  calculateSummary,
  Category,
  CategoryLimit,
  dateKeyFromParts,
  EntryType,
  hasDuplicateCategoryName,
  monthKey,
  normalizeCategoryName,
  RecurringTransaction,
  sortCategories,
  sortRecurring,
  sortTransactions,
  toCents,
  Transaction,
} from "../lib/finance";
import {
  centsToInput,
  isDuplicateCategoryError,
  replaceItemById,
} from "../lib/dashboard-helpers";
import {
  createCategory,
  createRecurringTransaction,
  createTransaction,
  DashboardProfile,
  deleteCategoryById,
  deleteCategoryLimitById,
  deleteRecurringTransactionById,
  deleteTransactionById,
  loadDashboardData,
  updateCategoryById,
  updateProfileDisplayName,
  updateRecurringActiveState,
  updateRecurringTransactionById,
  updateTransactionById,
  updateTransactionPaidState,
  upsertCategoryLimit,
} from "../lib/dashboard-api";
import { profileApi } from "../lib/api-client";
import { useMessage } from "./useMessage";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

type DashboardTab =
  | "resumo"
  | "lancamentos"
  | "recorrencias"
  | "categorias"
  | "limites"
  | "relatorios"
  | "configuracoes";

type PendingAction =
  | "refresh"
  | "transaction"
  | "category"
  | "limit"
  | "recurring"
  | "paid"
  | "profile"
  | "email"
  | "password"
  | "confirm"
  | null;

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

type TransactionForm = {
  type: EntryType;
  description: string;
  amount: string;
  entry_date: string;
  category_id: string;
  notes: string;
};

type RecurringForm = {
  type: EntryType;
  description: string;
  amount: string;
  category_id: string;
  day_of_month: string;
};

type CategoryForm = {
  name: string;
  color: string;
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDashboard() {
  const { user } = useAuth();

  /* -- estado global do dashboard -- */
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("resumo");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { message, messageTone, setMessage } = useMessage(6500);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [mobileInputFocused, setMobileInputFocused] = useState(false);

  /* -- estados de edicao / modais -- */
  const [editingTransaction, setEditingTransaction] =
    useState<(TransactionForm & { id: string }) | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<(CategoryForm & { id: string; type: EntryType }) | null>(null);
  const [editingRecurring, setEditingRecurring] =
    useState<(RecurringForm & { id: string; is_active: boolean }) | null>(null);
  const [editingLimitCategoryId, setEditingLimitCategoryId] = useState<string | null>(null);
  const [limitForm, setLimitForm] = useState({ category_id: "", amount: "" });

  const isBusy = pendingAction !== null;

  const generatedRecurringIds = useMemo(() => {
    return new Set(
      transactions
        .filter((t) => t.source_recurring_id && t.source_month === selectedMonth)
        .map((t) => t.source_recurring_id!),
    );
  }, [transactions, selectedMonth]);

  const summary = useMemo(
    () => calculateSummary(transactions, recurring, generatedRecurringIds),
    [transactions, recurring, generatedRecurringIds],
  );

  /* -- carregamento de dados -- */
  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, user]);

  /* -- mobile keyboard handling -- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 680px)");
    const isFormField = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest("input, select, textarea"));

    const handleFocusIn = (event: FocusEvent) => {
      if (query.matches && isFormField(event.target)) setMobileInputFocused(true);
    };
    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        if (!query.matches) return setMobileInputFocused(false);
        setMobileInputFocused(isFormField(document.activeElement));
      });
    };
    const handleQueryChange = () => {
      if (!query.matches) setMobileInputFocused(false);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    query.addEventListener("change", handleQueryChange);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      query.removeEventListener("change", handleQueryChange);
    };
  }, []);

  /* -- helpers de categoria -- */
  const categoryNameFor = useCallback(
    (id: string | null) => categories.find((item) => item.id === id)?.name ?? "Sem categoria",
    [categories],
  );

  /* -- carregar dados -- */
  async function loadData(showRefreshMessage = false) {
    if (!user) return;
    setLoading(true);
    if (showRefreshMessage) setPendingAction("refresh");

    try {
      const results = await loadDashboardData(selectedMonth);

      setProfile(results.profile);
      setCategories(sortCategories(results.categories));
      setCategoryLimits(results.categoryLimits);
      setTransactions(sortTransactions(results.transactions));
      setRecurring(sortRecurring(results.recurring));
      if (showRefreshMessage) setMessage("Dados atualizados.");
    } catch {
      setMessage("Nao foi possivel carregar os dados agora.", "error");
    } finally {
      setLoading(false);
      if (showRefreshMessage) setPendingAction(null);
    }
  }

  /* -- acoes de transacao -- */
  async function apiCreateTransaction(data: Omit<Transaction, "id" | "created_at">) {
    return createTransaction(data as any);
  }

  async function handleDeleteTransaction(id: string) {
    if (!user) return;
    setConfirmDialog({
      title: "Apagar lancamento?",
      message: "Esta acao remove o lancamento deste mes.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await deleteTransactionById(id, "");
        if (error) {
          setMessage("Nao foi possivel apagar o lancamento.");
          return;
        }
        setTransactions((current) => current.filter((item) => item.id !== id));
        setMessage("Lancamento apagado.");
      },
    });
  }

  function beginEditTransaction(item: Transaction) {
    setEditingTransaction({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: centsToInput(item.amount_cents),
      entry_date: item.entry_date,
      category_id: item.category_id ?? "",
      notes: item.notes ?? "",
    });
  }

  async function handleUpdateTransaction(event: FormEvent) {
    event.preventDefault();
    if (!editingTransaction || isBusy) return;
    const amount = toCents(editingTransaction.amount);
    if (!amount || !editingTransaction.entry_date) {
      setMessage("Preencha valor e data para salvar.");
      return;
    }
    setPendingAction("transaction");
    try {
      const { data, error } = await updateTransactionById(editingTransaction.id, "", {
        type: editingTransaction.type,
        description: editingTransaction.description.trim(),
        amount_cents: amount,
        entry_date: editingTransaction.entry_date,
        category_id: editingTransaction.category_id || null,
        notes: editingTransaction.notes.trim() || null,
      });
      if (error) {
        setMessage("Nao foi possivel atualizar o lancamento.");
        return;
      }
      if (data) {
        setTransactions((current) => {
          const without = current.filter((item) => item.id !== data.id);
          return data.entry_date.startsWith(`${selectedMonth}-`)
            ? sortTransactions([data, ...without])
            : without;
        });
      }
      setEditingTransaction(null);
      setMessage("Lancamento atualizado.");
    } catch {
      setMessage("Nao foi possivel atualizar o lancamento.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleTogglePaid(item: Transaction) {
    if (!user || item.type !== "saida" || isBusy) return;
    setPendingAction("paid");
    try {
      const { data, error } = await updateTransactionPaidState(item.id, "", !item.is_paid);
      if (error) {
        setMessage("Nao foi possivel alterar o status de pagamento.");
        return;
      }
      if (data) {
        setTransactions((current) => sortTransactions(replaceItemById(current, data)));
      }
      setMessage("Status atualizado.");
    } catch {
      setMessage("Nao foi possivel alterar o status de pagamento.");
    } finally {
      setPendingAction(null);
    }
  }

  /* -- acoes de recorrencia -- */
  async function apiCreateRecurring(data: Omit<RecurringTransaction, "id" | "is_active" | "created_at">) {
    return createRecurringTransaction({ ...data, is_active: true } as any);
  }

  async function handleDeleteRecurring(id: string) {
    if (!user) return;
    setConfirmDialog({
      title: "Apagar recorrencia?",
      message: "Lancamentos ja gerados continuam salvos.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await deleteRecurringTransactionById(id, "");
        if (error) {
          setMessage("Nao foi possivel apagar a recorrencia.");
          return;
        }
        setRecurring((current) => current.filter((item) => item.id !== id));
        setMessage("Recorrencia apagada.");
      },
    });
  }

  function beginEditRecurring(item: RecurringTransaction) {
    setEditingRecurring({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: centsToInput(item.amount_cents),
      category_id: item.category_id ?? "",
      day_of_month: String(item.day_of_month),
      is_active: item.is_active,
    });
  }

  async function handleToggleRecurring(item: RecurringTransaction) {
    if (!user || isBusy) return;
    setPendingAction("recurring");
    try {
      const { data, error } = await updateRecurringActiveState(item.id, "", !item.is_active);
      if (error) {
        setMessage("Nao foi possivel alterar a recorrencia.");
        return;
      }
      if (data) {
        setRecurring((current) => sortRecurring(replaceItemById(current, data)));
      }
      setMessage("Recorrencia atualizada.");
    } catch {
      setMessage("Nao foi possivel alterar a recorrencia.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateFromRecurring(item: RecurringTransaction) {
    if (!user) return;
    if (!item.is_active) {
      setMessage("Esta recorrencia esta pausada.");
      return;
    }
    const alreadyGenerated = transactions.some(
      (t) => t.source_recurring_id === item.id && t.source_month === selectedMonth,
    );
    if (alreadyGenerated) {
      setMessage("Esta recorrencia ja foi gerada neste mes.");
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const date = dateKeyFromParts(year, month, item.day_of_month);

    setPendingAction("recurring");
    try {
      const { data, error } = await createTransaction({
        user_id: user.id,
        type: item.type,
        description: item.description,
        amount_cents: item.amount_cents,
        entry_date: date,
        category_id: item.category_id,
        notes: `Gerado de recorrencia:${item.id}:${selectedMonth}`,
        source_recurring_id: item.id,
        source_month: selectedMonth,
        is_paid: false,
      } as any);

      if (error) {
        setMessage(
          isDuplicateCategoryError(error) ? "Esta recorrencia ja foi gerada neste mes." : "Nao foi possivel gerar o lancamento.",
        );
        return;
      }
      if (data) {
        setTransactions((current) => sortTransactions([data, ...current]));
      }
      setMessage("Lancamento gerado.");
    } catch {
      setMessage("Nao foi possivel gerar o lancamento.");
    } finally {
      setPendingAction(null);
    }
  }

  /* -- acoes de categoria -- */
  async function apiCreateCategory(data: { name: string; type: EntryType; color: string }) {
    return createCategory(data);
  }

  async function handleDeleteCategory(id: string) {
    if (!user) return;
    setConfirmDialog({
      title: "Apagar categoria?",
      message: "Lancamentos antigos continuam salvos e ficam sem categoria.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await deleteCategoryById(id, "");
        if (error) {
          setMessage("Nao foi possivel apagar a categoria.");
          return;
        }
        setCategories((current) => current.filter((item) => item.id !== id));
        setCategoryLimits((current) => current.filter((item) => item.category_id !== id));
        setTransactions((current) =>
          current.map((item) => (item.category_id === id ? { ...item, category_id: null } : item)),
        );
        setRecurring((current) =>
          current.map((item) => (item.category_id === id ? { ...item, category_id: null } : item)),
        );
        setMessage("Categoria apagada.");
      },
    });
  }

  async function handleUpdateCategory(event: FormEvent) {
    event.preventDefault();
    if (!editingCategory || isBusy) return;
    if (!editingCategory.name.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }
    if (hasDuplicateCategoryName(categories, editingCategory.name, editingCategory.type, editingCategory.id)) {
      setMessage("Ja existe uma categoria com esse nome neste grupo.");
      return;
    }
    setPendingAction("category");
    try {
      const { data, error } = await updateCategoryById(editingCategory.id, "", {
        name: editingCategory.name.trim(),
        color: editingCategory.color,
      });
      if (error) {
        setMessage(
          isDuplicateCategoryError(error)
            ? "Ja existe uma categoria com esse nome neste grupo."
            : "Nao foi possivel atualizar a categoria.",
        );
        return;
      }
      if (data) {
        setCategories((current) => sortCategories(replaceItemById(current, data)));
      }
      setEditingCategory(null);
      setMessage("Categoria atualizada.");
    } catch {
      setMessage("Nao foi possivel atualizar a categoria.");
    } finally {
      setPendingAction(null);
    }
  }

  /* -- acoes de limite -- */
  async function handleSaveLimit(event: FormEvent) {
    event.preventDefault();
    if (!user || isBusy) return;
    const amount = toCents(limitForm.amount);
    if (!limitForm.category_id || !amount) {
      setMessage("Escolha uma categoria e informe o limite.");
      return;
    }
    setPendingAction("limit");
    try {
      const { data, error } = await upsertCategoryLimit({
        user_id: user.id,
        category_id: limitForm.category_id,
        amount_cents: amount,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        setMessage("Nao foi possivel salvar o limite.");
        return;
      }
      if (data) {
        setCategoryLimits((current) => {
          const idx = current.findIndex((item) => item.id === data.id || item.category_id === data.category_id);
          if (idx === -1) return [...current, data];
          return current.map((item, i) => (i === idx ? data : item));
        });
      }
      setMessage("Limite salvo.");
      setLimitForm({ category_id: "", amount: "" });
      setEditingLimitCategoryId(null);
    } catch {
      setMessage("Nao foi possivel salvar o limite.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleDeleteLimit(id: string) {
    if (!user) return;
    const limitToDelete = categoryLimits.find((item) => item.id === id);
    setConfirmDialog({
      title: "Remover limite?",
      message: "A categoria continua existindo, apenas o limite mensal sera removido.",
      confirmLabel: "Remover",
      onConfirm: async () => {
        const { error } = await deleteCategoryLimitById(id, "");
        if (error) {
          setMessage("Nao foi possivel remover o limite.");
          return;
        }
        setCategoryLimits((current) => current.filter((item) => item.id !== id));
        if (limitForm.category_id === limitToDelete?.category_id) {
          setLimitForm({ category_id: "", amount: "" });
        }
        setMessage("Limite removido.");
      },
    });
  }

  /* -- configuracoes -- */
  async function handleUpdateDisplayName(name: string) {
    if (isBusy || !user) return { error: true };
    setPendingAction("profile");
    try {
      const { error } = await updateProfileDisplayName("", "", name || null);
      if (error) {
        setMessage("Nao foi possivel salvar o nome exibido.");
        return { error };
      }
      setProfile((current) =>
        current
          ? { ...current, display_name: name || null, email: user.username ?? current.email }
          : { id: user.id, email: user.username ?? "", display_name: name || null },
      );
      setMessage("Nome exibido salvo.");
      return {};
    } catch {
      setMessage("Nao foi possivel salvar o nome exibido.");
      return { error: true };
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateUsername(username: string) {
    if (isBusy) return { error: true };
    setPendingAction("email");
    try {
      const { error } = (await profileApi.update({ username })) as any;
      setMessage(error ? "Nao foi possivel atualizar o usuario." : "Usuario atualizado.");
      return { error };
    } catch {
      setMessage("Nao foi possivel atualizar o usuario.");
      return { error: true };
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdatePassword(password: string) {
    if (isBusy) return { error: true };
    setPendingAction("password");
    try {
      const { error } = (await profileApi.update({ password })) as any;
      if (error) {
        setMessage("Nao foi possivel atualizar a senha.");
        return { error };
      }
      setMessage("Senha atualizada.");
      return {};
    } catch {
      setMessage("Nao foi possivel atualizar a senha.");
      return { error: true };
    } finally {
      setPendingAction(null);
    }
  }

  /* -- exportar CSV -- */
  function exportReportCSV() {
    const sanitizeCsv = (val: string | number) => {
      const str = String(val).replace(/"/g, '""');
      if (/^[=?+\-@]/.test(str)) return `'${str}`;
      return `"${str}"`;
    };

    const rows = [
      ["Data", "Descricao", "Categoria", "Valor", "Tipo", "Status"],
      ...transactions.map((t) => [
        t.entry_date,
        t.description,
        categoryNameFor(t.category_id),
        (t.amount_cents / 100).toFixed(2).replace(".", ","),
        t.type === "entrada" ? "Entrada" : "Saida",
        t.is_paid ? "Pago" : "Pendente",
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => sanitizeCsv(cell)).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("Relatorio exportado.");
  }

  /* -- dialogo de confirmacao -- */
  async function confirmCurrentAction() {
    if (!confirmDialog || isBusy) return;
    setPendingAction("confirm");
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch {
      setMessage("Nao foi possivel concluir a acao.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  /* -- update de recorrencia (handler inline) -- */
  async function handleUpdateRecurring(event: FormEvent) {
    event.preventDefault();
    if (!editingRecurring || isBusy) return;
    const amount = toCents(editingRecurring.amount);
    const day = Number(editingRecurring.day_of_month);
    if (!amount || day < 1 || day > 28) {
      setMessage("Preencha recorrencia com valor e dia entre 1 e 28.");
      return;
    }
    setPendingAction("recurring");
    try {
      const { data, error } = await updateRecurringTransactionById(editingRecurring.id, "", {
        type: editingRecurring.type,
        description: editingRecurring.description.trim(),
        amount_cents: amount,
        category_id: editingRecurring.category_id || null,
        day_of_month: day,
        is_active: editingRecurring.is_active,
      });
      if (error) {
        setMessage("Nao foi possivel atualizar a recorrencia.");
        return;
      }
      if (data) {
        setRecurring((current) => sortRecurring(replaceItemById(current, data)));
      }
      setEditingRecurring(null);
      setMessage("Recorrencia atualizada.");
    } catch {
      setMessage("Nao foi possivel atualizar a recorrencia.");
    } finally {
      setPendingAction(null);
    }
  }

  return {
    // Estado
    user,
    selectedMonth,
    setSelectedMonth,
    categories,
    setCategories,
    categoryLimits,
    setCategoryLimits,
    transactions,
    setTransactions,
    recurring,
    setRecurring,
    profile,
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    loading,
    message,
    messageTone,
    pendingAction,
    confirmDialog,
    setConfirmDialog,
    mobileInputFocused,
    editingTransaction,
    setEditingTransaction,
    editingCategory,
    setEditingCategory,
    editingRecurring,
    setEditingRecurring,
    editingLimitCategoryId,
    setEditingLimitCategoryId,
    limitForm,
    setLimitForm,
    isBusy,
    summary,
    generatedRecurringIds,
    categoryNameFor,

    // Acoes
    loadData,
    apiCreateTransaction,
    handleDeleteTransaction,
    beginEditTransaction,
    handleUpdateTransaction,
    handleTogglePaid,
    apiCreateRecurring,
    handleDeleteRecurring,
    beginEditRecurring,
    handleToggleRecurring,
    handleGenerateFromRecurring,
    handleUpdateRecurring,
    apiCreateCategory,
    handleDeleteCategory,
    handleUpdateCategory,
    handleSaveLimit,
    handleDeleteLimit,
    handleUpdateDisplayName,
    handleUpdateUsername,
    handleUpdatePassword,
    exportReportCSV,
    confirmCurrentAction,
  };
}
