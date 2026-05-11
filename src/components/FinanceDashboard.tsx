import { useAuth } from "../context/AuthContext";
import { EntryType } from "../lib/finance";
import { centsToInput, shiftMonthKey } from "../lib/dashboard-helpers";
import { useDashboard } from "../hooks/useDashboard";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
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
  Repeat2,
  Gauge,
  Settings,
} from "lucide-react";

type DashboardTab =
  | "resumo"
  | "lancamentos"
  | "recorrencias"
  | "categorias"
  | "limites"
  | "relatorios"
  | "configuracoes";

const tabs: Array<{ id: DashboardTab; label: string; icon: typeof Home }> = [
  { id: "resumo", label: "Resumo", icon: Home },
  { id: "lancamentos", label: "Lancamentos", icon: ReceiptText },
  { id: "recorrencias", label: "Recorrencias", icon: Repeat2 },
  { id: "categorias", label: "Categorias", icon: FolderOpen },
  { id: "limites", label: "Limites", icon: Gauge },
  { id: "relatorios", label: "Relatorios", icon: BarChart3 },
  { id: "configuracoes", label: "Configuracoes", icon: Settings },
];

export function FinanceDashboard() {
  const { signOut } = useAuth();
  const d = useDashboard();

  const { pulling, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: () => d.loadData(true),
    disabled: d.loading || d.isBusy,
  });

  const profileLabel = d.profile?.display_name?.trim() || d.user?.username || "Controle pessoal";

  const navigation = tabs.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        className={d.activeTab === tab.id ? "active" : ""}
        onClick={() => d.setActiveTab(tab.id)}
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
      className={`${d.sidebarCollapsed ? "app-layout sidebar-collapsed" : "app-layout"} ${
        d.mobileInputFocused ? "mobile-input-focused" : ""
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
            onClick={() => d.setSidebarCollapsed((current) => !current)}
            title={d.sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={d.sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-pressed={d.sidebarCollapsed}
          >
            {d.sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{d.sidebarCollapsed ? "Expandir" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      {/* App shell */}
      <section className="app-shell">
        {/* Pull-to-refresh indicator */}
        <div
          className={`pull-indicator ${pulling ? "is-pulling" : ""} ${refreshing ? "is-refreshing" : ""}`}
          style={pullDistance > 0 ? { transform: `translateY(${Math.min(pullDistance, 60)}px)` } : undefined}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          {refreshing ? "Atualizando..." : pulling ? "Solte para atualizar" : ""}
        </div>

        {/* Topbar */}
        <header className="topbar">
          <div>
            <p>{profileLabel}</p>
            <h1>Financas</h1>
          </div>
          <div className="topbar-actions">
            <div className="month-nav" role="group" aria-label="Navegacao de mes">
              <button className="icon-button" onClick={() => d.setSelectedMonth((c) => shiftMonthKey(c, -1))} title="Mes anterior" aria-label="Mes anterior">
                <ChevronLeft size={18} />
              </button>
              <input
                aria-label="Mes"
                className="month-picker"
                type="month"
                value={d.selectedMonth}
                onChange={(e) => d.setSelectedMonth(e.target.value)}
              />
              <button className="icon-button" onClick={() => d.setSelectedMonth((c) => shiftMonthKey(c, 1))} title="Mes seguinte" aria-label="Mes seguinte">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Toast */}
        {d.message && (
          <div
            role="status"
            aria-live="polite"
            className={`toast ${d.messageTone}`}
            style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 9999 }}
          >
            {d.message}
          </div>
        )}

        {/* Mobile tabbar */}
        <nav className={`mobile-tabbar ${d.mobileInputFocused ? "is-collapsed" : ""}`} aria-label="Areas do app">
          {navigation}
        </nav>

        {/* === ABAS === */}
        {d.loading ? (
          <DashboardSkeleton activeTab={d.activeTab} />
        ) : (
          <>
            {d.activeTab === "resumo" && (
              <ResumoTab
                transactions={d.transactions}
                recurring={d.recurring}
                generatedRecurringIds={d.generatedRecurringIds}
                loading={d.loading}
                isBusy={d.isBusy}
                pendingAction={d.pendingAction}
                onRefresh={() => d.loadData(true)}
                categoryNameFor={d.categoryNameFor}
                onDelete={d.handleDeleteTransaction}
                onEdit={d.beginEditTransaction}
                onTogglePaid={d.handleTogglePaid}
              />
            )}

            {d.activeTab === "lancamentos" && (
              <LancamentosTab
                transactions={d.transactions}
                categories={d.categories}
                selectedMonth={d.selectedMonth}
                loading={d.loading}
                isBusy={d.isBusy}
                pendingAction={d.pendingAction}
                onRefresh={() => d.loadData(true)}
                onAdd={d.apiCreateTransaction}
                onDelete={d.handleDeleteTransaction}
                onEdit={d.beginEditTransaction}
                onTogglePaid={d.handleTogglePaid}
                onSetTransactions={d.setTransactions}
                categoryNameFor={d.categoryNameFor}
              />
            )}

            {d.activeTab === "recorrencias" && (
              <RecorrenciasTab
                recurring={d.recurring}
                categories={d.categories}
                transactions={d.transactions}
                selectedMonth={d.selectedMonth}
                isBusy={d.isBusy}
                pendingAction={d.pendingAction}
                onAdd={d.apiCreateRecurring}
                onDelete={d.handleDeleteRecurring}
                onToggle={d.handleToggleRecurring}
                onGenerate={d.handleGenerateFromRecurring}
                onEdit={d.beginEditRecurring}
                onSetRecurring={d.setRecurring}
                categoryNameFor={d.categoryNameFor}
              />
            )}

            {d.activeTab === "categorias" && (
              <CategoriasTab
                categories={d.categories}
                isBusy={d.isBusy}
                pendingAction={d.pendingAction}
                onAdd={d.apiCreateCategory}
                onDelete={d.handleDeleteCategory}
                onEdit={(item) => d.setEditingCategory({ id: item.id, type: item.type, name: item.name, color: item.color })}
                onSetCategories={d.setCategories}
              />
            )}

            {d.activeTab === "limites" && (
              <LimitesTab
                categories={d.categories}
                categoryLimits={d.categoryLimits}
                transactions={d.transactions}
                isBusy={d.isBusy}
                onEdit={(categoryId, currentLimit) => {
                  d.setEditingLimitCategoryId(categoryId);
                  d.setLimitForm({
                    category_id: categoryId,
                    amount: currentLimit ? centsToInput(currentLimit.amount_cents) : "",
                  });
                }}
                onDelete={d.handleDeleteLimit}
              />
            )}

            {d.activeTab === "relatorios" && (
              <RelatoriosTab
                transactions={d.transactions}
                recurring={d.recurring}
                generatedRecurringIds={d.generatedRecurringIds}
                categories={d.categories}
                categoryLimits={d.categoryLimits}
                selectedMonth={d.selectedMonth}
                isBusy={d.isBusy}
                onExportCSV={d.exportReportCSV}
                categoryNameFor={d.categoryNameFor}
              />
            )}

            {d.activeTab === "configuracoes" && (
              <ConfiguracoesTab
                profile={d.profile}
                userEmail={d.user?.username ?? null}
                isBusy={d.isBusy}
                pendingAction={d.pendingAction}
                onUpdateDisplayName={d.handleUpdateDisplayName}
                onUpdateEmail={d.handleUpdateUsername}
                onUpdatePassword={d.handleUpdatePassword}
              />
            )}
          </>
        )}

        {/* === MODAIS === */}
        {d.editingTransaction && (
          <DashboardModal title="Editar lancamento" onClose={() => d.setEditingTransaction(null)}>
            <form className="modal-form" onSubmit={d.handleUpdateTransaction}>
              <select
                value={d.editingTransaction.type}
                onChange={(e) =>
                  d.setEditingTransaction((current) =>
                    current ? { ...current, type: e.target.value as EntryType, category_id: "" } : current,
                  )
                }
              >
                <option value="saida">Saida</option>
                <option value="entrada">Entrada</option>
              </select>
              <input
                value={d.editingTransaction.description}
                onChange={(e) =>
                  d.setEditingTransaction((current) => (current ? { ...current, description: e.target.value } : current))
                }
              />
              <input
                value={d.editingTransaction.amount}
                inputMode="decimal"
                onChange={(e) =>
                  d.setEditingTransaction((current) => (current ? { ...current, amount: e.target.value } : current))
                }
              />
              <input
                type="date"
                value={d.editingTransaction.entry_date}
                onChange={(e) =>
                  d.setEditingTransaction((current) => (current ? { ...current, entry_date: e.target.value } : current))
                }
              />
              <select
                value={d.editingTransaction.category_id}
                onChange={(e) =>
                  d.setEditingTransaction((current) => (current ? { ...current, category_id: e.target.value } : current))
                }
              >
                <option value="">Categoria</option>
                {d.categories
                  .filter((item) => item.type === d.editingTransaction?.type)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <input
                value={d.editingTransaction.notes}
                placeholder="Observacao"
                onChange={(e) =>
                  d.setEditingTransaction((current) => (current ? { ...current, notes: e.target.value } : current))
                }
              />
              <button className="primary-button" disabled={d.isBusy}>
                {d.pendingAction === "transaction" ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </form>
          </DashboardModal>
        )}

        {d.editingCategory && (
          <DashboardModal title="Editar categoria" onClose={() => d.setEditingCategory(null)}>
            <form className="modal-form" onSubmit={d.handleUpdateCategory}>
              <input
                value={d.editingCategory.name}
                onChange={(e) =>
                  d.setEditingCategory((current) => (current ? { ...current, name: e.target.value } : current))
                }
              />
              <input
                type="color"
                value={d.editingCategory.color}
                onChange={(e) =>
                  d.setEditingCategory((current) => (current ? { ...current, color: e.target.value } : current))
                }
              />
              <button className="primary-button" disabled={d.isBusy}>
                {d.pendingAction === "category" ? "Salvando..." : "Salvar categoria"}
              </button>
            </form>
          </DashboardModal>
        )}

        {d.editingRecurring && (
          <DashboardModal title="Editar recorrencia" onClose={() => d.setEditingRecurring(null)}>
            <form className="modal-form" onSubmit={d.handleUpdateRecurring}>
              <select
                value={d.editingRecurring.type}
                onChange={(e) =>
                  d.setEditingRecurring((current) =>
                    current ? { ...current, type: e.target.value as EntryType, category_id: "" } : current,
                  )
                }
              >
                <option value="saida">Saida</option>
                <option value="entrada">Entrada</option>
              </select>
              <input
                value={d.editingRecurring.description}
                onChange={(e) =>
                  d.setEditingRecurring((current) => (current ? { ...current, description: e.target.value } : current))
                }
              />
              <input
                value={d.editingRecurring.amount}
                onChange={(e) =>
                  d.setEditingRecurring((current) => (current ? { ...current, amount: e.target.value } : current))
                }
              />
              <input
                type="number"
                min="1"
                max="31"
                value={d.editingRecurring.day_of_month}
                onChange={(e) =>
                  d.setEditingRecurring((current) => (current ? { ...current, day_of_month: e.target.value } : current))
                }
              />
              <select
                value={d.editingRecurring.category_id}
                onChange={(e) =>
                  d.setEditingRecurring((current) => (current ? { ...current, category_id: e.target.value } : current))
                }
              >
                <option value="">Categoria</option>
                {d.categories
                  .filter((item) => item.type === d.editingRecurring?.type)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={d.editingRecurring.is_active}
                  onChange={(e) =>
                    d.setEditingRecurring((current) => (current ? { ...current, is_active: e.target.checked } : current))
                  }
                />
                Recorrencia ativa
              </label>
              <button className="primary-button" disabled={d.isBusy}>
                {d.pendingAction === "recurring" ? "Salvando..." : "Salvar recorrencia"}
              </button>
            </form>
          </DashboardModal>
        )}

        {d.editingLimitCategoryId && (
          <DashboardModal
            title="Editar limite"
            onClose={() => {
              d.setEditingLimitCategoryId(null);
              d.setLimitForm({ category_id: "", amount: "" });
            }}
          >
            <form className="modal-form" onSubmit={d.handleSaveLimit}>
              <label>
                Categoria
                <input value={d.categoryNameFor(d.editingLimitCategoryId)} disabled />
              </label>
              <label>
                Limite mensal
                <input
                  placeholder="0,00"
                  inputMode="decimal"
                  value={d.limitForm.amount}
                  onChange={(e) => d.setLimitForm((current) => ({ ...current, amount: e.target.value }))}
                />
              </label>
              <button className="primary-button" disabled={d.isBusy}>
                {d.pendingAction === "limit" ? "Salvando..." : "Salvar limite"}
              </button>
            </form>
          </DashboardModal>
        )}

        {d.confirmDialog && (
          <DashboardModal title={d.confirmDialog.title} onClose={() => d.setConfirmDialog(null)}>
            <p className="confirm-message">{d.confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => d.setConfirmDialog(null)} disabled={d.isBusy}>
                Cancelar
              </button>
              <button className="danger-button" onClick={d.confirmCurrentAction} disabled={d.isBusy}>
                {d.pendingAction === "confirm" ? "Aguarde..." : d.confirmDialog.confirmLabel}
              </button>
            </div>
          </DashboardModal>
        )}
      </section>
    </main>
  );
}
