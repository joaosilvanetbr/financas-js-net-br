import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useMessage } from "../hooks/useMessage";
import { profileApi } from "../lib/api-client";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Home,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Gauge,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  calculateSummary,
  Category,
  CategoryLimit,
  dateKeyFromParts,
  EntryType,
  formatMoney,
  hasDuplicateCategoryName,
  monthKey,
  normalizeCategoryName,
  RecurringTransaction,
  sortCategories,
  sortRecurring,
  sortTransactions,
  todayKey,
  toCents,
  Transaction,
} from "../lib/finance";
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
import { DashboardModal } from "./dashboard/DashboardModal";
import { DashboardSkeleton } from "./dashboard/DashboardSkeleton";
import { SummaryCard } from "./dashboard/SummaryCard";
import { TransactionCards } from "./dashboard/TransactionCards";
import { ResumoTab } from "./dashboard/tabs/ResumoTab";
import { LancamentosTab } from "./dashboard/tabs/LancamentosTab";
import { RecorrenciasTab } from "./dashboard/tabs/RecorrenciasTab";
import { CategoriasTab } from "./dashboard/tabs/CategoriasTab";
import { LimitesTab } from "./dashboard/tabs/LimitesTab";
import { RelatoriosTab } from "./dashboard/tabs/RelatoriosTab";
import { ConfiguracoesTab } from "./dashboard/tabs/ConfiguracoesTab";

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

type PendingAction = "refresh" | "transaction" | "category" | "limit" | "recurring" | "paid" | "profile" | "email" | "password" | "confirm" | null;

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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function shiftMonthKey(value: string, delta: number) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return monthKey();

  const totalMonths = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = String((totalMonths % 12) + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function replaceItemById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function isDuplicateCategoryError(error: any) {
  const msg = error?.error || error?.message || String(error);
  return typeof msg === "string" && /unique|duplicate/i.test(msg);
}

/* ------------------------------------------------------------------ */
/*  Componente principal (orquestrador)                                */
/* ------------------------------------------------------------------ */

export function FinanceDashboard() {
  const { user, signOut } = useAuth();

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
  const [displayNameState, setDisplayNameState] = useState("");

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
      setDisplayNameState(results.profile?.display_name ?? "");
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
      // displayName atualizado no ConfiguracoesTab internamente
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
      const { error } = await profileApi.update({ username }) as any;
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
      const { error } = await profileApi.update({ password }) as any;
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
  const sanitizeCsv = (val: string | number) => {
    const str = String(val).replace(/"/g, '""');
    if (/^[=?+\-@]/.test(str)) return `'${str}`;
    return `"${str}"`;
  };

  function exportReportCSV() {
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

  /* -- navegacao -- */
  const tabs: Array<{ id: DashboardTab; label: string; icon: typeof Home }> = [
    { id: "resumo", label: "Resumo", icon: Home },
    { id: "lancamentos", label: "Lancamentos", icon: ReceiptText },
    { id: "recorrencias", label: "Recorrencias", icon: Repeat2 },
    { id: "categorias", label: "Categorias", icon: FolderOpen },
    { id: "limites", label: "Limites", icon: Gauge },
    { id: "relatorios", label: "Relatorios", icon: BarChart3 },
    { id: "configuracoes", label: "Configuracoes", icon: Settings },
  ];

  const profileLabel = profile?.display_name?.trim() || user?.username || "Controle pessoal";

  const navigation = tabs.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        className={activeTab === tab.id ? "active" : ""}
        onClick={() => setActiveTab(tab.id)}
        title={tab.label}
        aria-label={tab.label}
      >
        <Icon size={18} />
        <span>{tab.label}</span>
      </button>
    );
  });

  return (
    <main
      className={`${sidebarCollapsed ? "app-layout sidebar-collapsed" : "app-layout"} ${
        mobileInputFocused ? "mobile-input-focused" : ""
      }`}
    >
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="sidebar-brand">
          <div className="sidebar-mark">
            <img src="/icon-v2.svg" alt="" aria-hidden="true" />
          </div>
          <div className="sidebar-copy">
            <strong>Financas</strong>
            <span>{profileLabel}</span>
          </div>
        </div>
        <nav className="sidebar-nav">{navigation}</nav>
        <div className="sidebar-footer">
          <button className="sidebar-action" onClick={signOut} title="Sair" aria-label="Sair">
            <span className="sidebar-action-mark" aria-hidden="true">
              <LogOut size={16} />
            </span>
            <span>Sair</span>
          </button>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-pressed={sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{sidebarCollapsed ? "Expandir" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      {/* App shell */}
      <section className="app-shell">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <p>{profileLabel}</p>
            <h1>Financas</h1>
          </div>
          <div className="topbar-actions">
            <div className="month-nav" role="group" aria-label="Navegacao de mes">
              <button className="icon-button" onClick={() => setSelectedMonth((c) => shiftMonthKey(c, -1))} title="Mes anterior" aria-label="Mes anterior">
                <ChevronLeft size={18} />
              </button>
              <input
                aria-label="Mes"
                className="month-picker"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <button className="icon-button" onClick={() => setSelectedMonth((c) => shiftMonthKey(c, 1))} title="Mes seguinte" aria-label="Mes seguinte">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Toast */}
        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`toast ${messageTone}`}
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
            }}
          >
            {message}
          </div>
        )}

        {/* Mobile tabbar */}
        <nav className={`mobile-tabbar ${mobileInputFocused ? "is-collapsed" : ""}`} aria-label="Areas do app">
          {navigation}
        </nav>

        {/* === ABAS === */}
        {loading ? (
          <DashboardSkeleton activeTab={activeTab} />
        ) : (
          <>
        {activeTab === "resumo" && (
          <ResumoTab
            transactions={transactions}
            recurring={recurring}
            generatedRecurringIds={generatedRecurringIds}
            loading={loading}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onRefresh={() => loadData(true)}
            categoryNameFor={categoryNameFor}
            onDelete={handleDeleteTransaction}
            onEdit={beginEditTransaction}
            onTogglePaid={handleTogglePaid}
          />
        )}

        {activeTab === "lancamentos" && (
          <LancamentosTab
            transactions={transactions}
            categories={categories}
            selectedMonth={selectedMonth}
            loading={loading}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onRefresh={() => loadData(true)}
            onAdd={apiCreateTransaction}
            onDelete={handleDeleteTransaction}
            onEdit={beginEditTransaction}
            onTogglePaid={handleTogglePaid}
            onSetTransactions={setTransactions}
            categoryNameFor={categoryNameFor}
          />
        )}

        {activeTab === "recorrencias" && (
          <RecorrenciasTab
            recurring={recurring}
            categories={categories}
            transactions={transactions}
            selectedMonth={selectedMonth}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onAdd={apiCreateRecurring}
            onDelete={handleDeleteRecurring}
            onToggle={handleToggleRecurring}
            onGenerate={handleGenerateFromRecurring}
            onEdit={beginEditRecurring}
            onSetRecurring={setRecurring}
            categoryNameFor={categoryNameFor}
          />
        )}

        {activeTab === "categorias" && (
          <CategoriasTab
            categories={categories}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onAdd={apiCreateCategory}
            onDelete={handleDeleteCategory}
            onEdit={(item) => setEditingCategory({ id: item.id, type: item.type, name: item.name, color: item.color })}
            onSetCategories={setCategories}
          />
        )}

        {activeTab === "limites" && (
          <LimitesTab
            categories={categories}
            categoryLimits={categoryLimits}
            transactions={transactions}
            isBusy={isBusy}
            onEdit={(categoryId, currentLimit) => {
              setEditingLimitCategoryId(categoryId);
              setLimitForm({
                category_id: categoryId,
                amount: currentLimit ? centsToInput(currentLimit.amount_cents) : "",
              });
            }}
            onDelete={handleDeleteLimit}
          />
        )}

        {activeTab === "relatorios" && (
          <RelatoriosTab
            transactions={transactions}
            recurring={recurring}
            generatedRecurringIds={generatedRecurringIds}
            categories={categories}
            categoryLimits={categoryLimits}
            selectedMonth={selectedMonth}
            isBusy={isBusy}
            onExportCSV={exportReportCSV}
            categoryNameFor={categoryNameFor}
          />
        )}

        {activeTab === "configuracoes" && (
          <ConfiguracoesTab
            profile={profile}
            userEmail={user?.username ?? null}
            isBusy={isBusy}
            pendingAction={pendingAction}
            
            onUpdateDisplayName={handleUpdateDisplayName}
            onUpdateEmail={handleUpdateUsername}
            onUpdatePassword={handleUpdatePassword}
          />
        )}
          </>
        )}

        {/* === MODAIS === */}
        {editingTransaction && (
          <DashboardModal title="Editar lancamento" onClose={() => setEditingTransaction(null)}>
            <form
              className="modal-form"
              onSubmit={handleUpdateTransaction}
            >
              <select
                value={editingTransaction.type}
                onChange={(e) =>
                  setEditingTransaction((current) =>
                    current ? { ...current, type: e.target.value as EntryType, category_id: "" } : current,
                  )
                }
              >
                <option value="saida">Saida</option>
                <option value="entrada">Entrada</option>
              </select>
              <input
                value={editingTransaction.description}
                onChange={(e) =>
                  setEditingTransaction((current) => (current ? { ...current, description: e.target.value } : current))
                }
              />
              <input
                value={editingTransaction.amount}
                inputMode="decimal"
                onChange={(e) =>
                  setEditingTransaction((current) => (current ? { ...current, amount: e.target.value } : current))
                }
              />
              <input
                type="date"
                value={editingTransaction.entry_date}
                onChange={(e) =>
                  setEditingTransaction((current) => (current ? { ...current, entry_date: e.target.value } : current))
                }
              />
              <select
                value={editingTransaction.category_id}
                onChange={(e) =>
                  setEditingTransaction((current) => (current ? { ...current, category_id: e.target.value } : current))
                }
              >
                <option value="">Categoria</option>
                {categories
                  .filter((item) => item.type === editingTransaction.type)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <input
                value={editingTransaction.notes}
                placeholder="Observacao"
                onChange={(e) =>
                  setEditingTransaction((current) => (current ? { ...current, notes: e.target.value } : current))
                }
              />
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "transaction" ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </form>
          </DashboardModal>
        )}

        {editingCategory && (
          <DashboardModal title="Editar categoria" onClose={() => setEditingCategory(null)}>
            <form className="modal-form" onSubmit={handleUpdateCategory}>
              <input
                value={editingCategory.name}
                onChange={(e) =>
                  setEditingCategory((current) => (current ? { ...current, name: e.target.value } : current))
                }
              />
              <input
                type="color"
                value={editingCategory.color}
                onChange={(e) =>
                  setEditingCategory((current) => (current ? { ...current, color: e.target.value } : current))
                }
              />
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "category" ? "Salvando..." : "Salvar categoria"}
              </button>
            </form>
          </DashboardModal>
        )}

        {editingRecurring && (
          <DashboardModal title="Editar recorrencia" onClose={() => setEditingRecurring(null)}>
            <form
              className="modal-form"
              onSubmit={async (event) => {
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
              }}
            >
              <select
                value={editingRecurring.type}
                onChange={(e) =>
                  setEditingRecurring((current) =>
                    current ? { ...current, type: e.target.value as EntryType, category_id: "" } : current,
                  )
                }
              >
                <option value="saida">Saida</option>
                <option value="entrada">Entrada</option>
              </select>
              <input
                value={editingRecurring.description}
                onChange={(e) =>
                  setEditingRecurring((current) => (current ? { ...current, description: e.target.value } : current))
                }
              />
              <input
                value={editingRecurring.amount}
                onChange={(e) =>
                  setEditingRecurring((current) => (current ? { ...current, amount: e.target.value } : current))
                }
              />
              <input
                type="number"
                min="1"
                max="31"
                value={editingRecurring.day_of_month}
                onChange={(e) =>
                  setEditingRecurring((current) => (current ? { ...current, day_of_month: e.target.value } : current))
                }
              />
              <select
                value={editingRecurring.category_id}
                onChange={(e) =>
                  setEditingRecurring((current) => (current ? { ...current, category_id: e.target.value } : current))
                }
              >
                <option value="">Categoria</option>
                {categories
                  .filter((item) => item.type === editingRecurring.type)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editingRecurring.is_active}
                  onChange={(e) =>
                    setEditingRecurring((current) => (current ? { ...current, is_active: e.target.checked } : current))
                  }
                />
                Recorrencia ativa
              </label>
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "recurring" ? "Salvando..." : "Salvar recorrencia"}
              </button>
            </form>
          </DashboardModal>
        )}

        {editingLimitCategoryId && (
          <DashboardModal
            title="Editar limite"
            onClose={() => {
              setEditingLimitCategoryId(null);
              setLimitForm({ category_id: "", amount: "" });
            }}
          >
            <form className="modal-form" onSubmit={handleSaveLimit}>
              <label>
                Categoria
                <input value={categoryNameFor(editingLimitCategoryId)} disabled />
              </label>
              <label>
                Limite mensal
                <input
                  placeholder="0,00"
                  inputMode="decimal"
                  value={limitForm.amount}
                  onChange={(e) => setLimitForm((current) => ({ ...current, amount: e.target.value }))}
                />
              </label>
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "limit" ? "Salvando..." : "Salvar limite"}
              </button>
            </form>
          </DashboardModal>
        )}

        {confirmDialog && (
          <DashboardModal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setConfirmDialog(null)} disabled={isBusy}>
                Cancelar
              </button>
              <button className="danger-button" onClick={confirmCurrentAction} disabled={isBusy}>
                {pendingAction === "confirm" ? "Aguarde..." : confirmDialog.confirmLabel}
              </button>
            </div>
          </DashboardModal>
        )}
      </section>
    </main>
  );
}
