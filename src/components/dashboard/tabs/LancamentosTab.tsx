import { FormEvent, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  Category,
  EntryType,
  formatMoney,
  toCents,
  Transaction,
  todayKey,
  sortTransactions,
  isInSelectedMonth,
} from "../../../lib/finance";
import { TransactionCards } from "../TransactionCards";

type TransactionForm = {
  type: EntryType;
  description: string;
  amount: string;
  entry_date: string;
  category_id: string;
  notes: string;
};

type LancamentosTabProps = {
  transactions: Transaction[];
  categories: Category[];
  selectedMonth: string;
  loading: boolean;
  isBusy: boolean;
  pendingAction: string | null;
  onRefresh: () => void;
  onAdd: (data: Omit<Transaction, "id" | "created_at">) => Promise<{ data?: Transaction | null; error?: any }>;
  onDelete: (id: string) => void;
  onEdit: (item: Transaction) => void;
  onTogglePaid: (item: Transaction) => void;
  onSetTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  categoryNameFor: (id: string | null) => string;
};

export function LancamentosTab({
  transactions,
  categories,
  selectedMonth,
  loading,
  isBusy,
  pendingAction,
  onRefresh,
  onAdd,
  onDelete,
  onEdit,
  onTogglePaid,
  onSetTransactions,
  categoryNameFor,
}: LancamentosTabProps) {
  const [form, setForm] = useState<TransactionForm>({
    type: "saida",
    description: "",
    amount: "",
    entry_date: todayKey(),
    category_id: "",
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "paid" | "pending">("");

  const categoriesByType = categories.filter((item) => item.type === form.type);

  const filtered = transactions.filter((item) => {
    const matchesSearch =
      search === "" ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      categoryNameFor(item.category_id).toLowerCase().includes(search.toLowerCase()) ||
      String(item.amount_cents / 100).includes(search);
    const matchesCategory = filterCategory === "" || item.category_id === filterCategory;
    const matchesStatus =
      filterStatus === "" || (filterStatus === "paid" ? item.is_paid : !item.is_paid);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;

    const amount = toCents(form.amount);
    if (!amount || !form.description.trim() || !form.entry_date) return;

    const { data, error } = await onAdd({
      type: form.type,
      description: form.description.trim(),
      amount_cents: amount,
      entry_date: form.entry_date,
      category_id: form.category_id || null,
      notes: form.notes.trim() || null,
      is_paid: false,
    } as any);

    if (error || !data) return;

    if (isInSelectedMonth(data.entry_date, selectedMonth)) {
      onSetTransactions((current) => sortTransactions([data, ...current]));
    }

    setForm((current) => ({ ...current, description: "", amount: "", notes: "" }));
  }

  return (
    <section className="tab-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Entradas e saidas</p>
          <h2>Lancamentos do mes</h2>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={isBusy}>
          <RefreshCw size={16} />
          {pendingAction === "refresh" ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <form className="entry-form quick-entry-form" onSubmit={handleSubmit}>
        <label>
          Tipo
          <select
            value={form.type}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                type: e.target.value as EntryType,
                category_id: "",
              }))
            }
          >
            <option value="saida">Saida</option>
            <option value="entrada">Entrada</option>
          </select>
        </label>
        <label className="quick-entry-form__description">
          Descricao
          <input
            placeholder="Ex: mercado, salario, seguro"
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
          />
        </label>
        <label>
          Valor
          <input
            placeholder="0,00"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
          />
        </label>
        <label>
          Data
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) => setForm((current) => ({ ...current, entry_date: e.target.value }))}
          />
        </label>
        <label>
          Categoria
          <select
            value={form.category_id}
            onChange={(e) => setForm((current) => ({ ...current, category_id: e.target.value }))}
          >
            <option value="">Sem categoria</option>
            {categoriesByType.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" disabled={isBusy}>
          <Plus size={16} />
          {pendingAction === "transaction" ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="filter-bar" style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <label className="visually-hidden" htmlFor="search-transactions">Buscar</label>
        <input
          id="search-transactions"
          placeholder="Buscar por descricao, categoria ou valor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <label className="visually-hidden" htmlFor="filter-category">Categoria</label>
        <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="filter-status">Status</label>
        <select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
        </select>
      </div>

      <TransactionCards
        transactions={filtered}
        loading={loading}
        categoryNameFor={categoryNameFor}
        deleteTransaction={onDelete}
        editTransaction={onEdit}
        togglePaid={onTogglePaid}
        isBusy={isBusy}
      />
    </section>
  );
}
