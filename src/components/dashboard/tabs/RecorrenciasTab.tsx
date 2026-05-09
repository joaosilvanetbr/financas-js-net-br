import { FormEvent, useState } from "react";
import { Plus, PauseCircle, PlayCircle, Pencil, Trash2 } from "lucide-react";
import {
  Category,
  EntryType,
  formatMoney,
  toCents,
  RecurringTransaction,
  sortRecurring,
} from "../../../lib/finance";
import { useSortableTable } from "../../../hooks/useSortableTable";

type RecurringForm = {
  type: EntryType;
  description: string;
  amount: string;
  category_id: string;
  day_of_month: string;
};

type RecorrenciasTabProps = {
  recurring: RecurringTransaction[];
  categories: Category[];
  transactions: Array<{ source_recurring_id?: string | null; source_month?: string | null; notes?: string | null; description: string; type: EntryType; amount_cents: number; category_id: string | null }>;
  selectedMonth: string;
  isBusy: boolean;
  pendingAction: string | null;
  onAdd: (data: Omit<RecurringTransaction, "id" | "is_active" | "created_at">) => Promise<{ data?: RecurringTransaction | null; error?: any }>;
  onDelete: (id: string) => void;
  onToggle: (item: RecurringTransaction) => void;
  onGenerate: (item: RecurringTransaction) => void;
  onEdit: (item: RecurringTransaction) => void;
  onSetRecurring: React.Dispatch<React.SetStateAction<RecurringTransaction[]>>;
  categoryNameFor: (id: string | null) => string;
};

type RecurringSortKey = "day" | "type" | "description" | "category" | "amount" | "status";

export function RecorrenciasTab({
  recurring,
  categories,
  transactions,
  selectedMonth,
  isBusy,
  pendingAction,
  onAdd,
  onDelete,
  onToggle,
  onGenerate,
  onEdit,
  onSetRecurring,
  categoryNameFor,
}: RecorrenciasTabProps) {
  const [form, setForm] = useState<RecurringForm>({
    type: "saida",
    description: "",
    amount: "",
    category_id: "",
    day_of_month: "5",
  });

  const { sortKey, sortDirection, toggleSort, indicator } = useSortableTable<RecurringSortKey>("day");

  function recurringAlreadyGenerated(item: RecurringTransaction) {
    return transactions.some((transaction) => {
      const hasNewMarker =
        transaction.source_recurring_id === item.id && transaction.source_month === selectedMonth;
      const hasLegacyMarker =
        transaction.notes?.includes(`recorrencia:${item.id}:${selectedMonth}`) ||
        (transaction.notes?.includes("Gerado de recorrencia") &&
          transaction.description === item.description &&
          transaction.type === item.type &&
          transaction.amount_cents === item.amount_cents &&
          transaction.category_id === item.category_id);
      return hasNewMarker || hasLegacyMarker;
    });
  }

  const sorted = [...recurring].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    let result = 0;
    if (sortKey === "day") result = a.day_of_month - b.day_of_month;
    if (sortKey === "type") result = a.type.localeCompare(b.type, "pt-BR");
    if (sortKey === "description") result = a.description.localeCompare(b.description, "pt-BR");
    if (sortKey === "category") {
      result = categoryNameFor(a.category_id).localeCompare(categoryNameFor(b.category_id), "pt-BR");
    }
    if (sortKey === "amount") result = a.amount_cents - b.amount_cents;
    if (sortKey === "status") {
      const statusFor = (item: RecurringTransaction) => {
        if (recurringAlreadyGenerated(item)) return "gerada neste mes";
        return item.is_active ? "ativa" : "pausada";
      };
      result = statusFor(a).localeCompare(statusFor(b), "pt-BR");
    }
    return result * dir;
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;

    const amount = toCents(form.amount);
    const day = Number(form.day_of_month);
    if (!amount || !form.description.trim() || day < 1 || day > 28) return;

    const { data, error } = await onAdd({
      type: form.type,
      description: form.description.trim(),
      amount_cents: amount,
      category_id: form.category_id || null,
      day_of_month: day,
    } as any);

    if (error || !data) return;

    onSetRecurring((current) => sortRecurring([...current, data]));
    setForm((current) => ({ ...current, description: "", amount: "" }));
  }

  const categoriesByType = categories.filter((item) => item.type === form.type);

  return (
    <section className="tab-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Contas fixas</p>
          <h2>Recorrencias</h2>
        </div>
      </div>

      <form className="recurring-form card-form" onSubmit={handleSubmit}>
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
        <input
          placeholder="Descricao"
          value={form.description}
          onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
        />
        <input
          placeholder="Valor"
          value={form.amount}
          onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
        />
        <input
          type="number"
          min="1"
          max="31"
          value={form.day_of_month}
          onChange={(e) => setForm((current) => ({ ...current, day_of_month: e.target.value }))}
        />
        <select
          value={form.category_id}
          onChange={(e) => setForm((current) => ({ ...current, category_id: e.target.value }))}
        >
          <option value="">Categoria</option>
          {categoriesByType.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button className="primary-button" disabled={isBusy}>
          <Plus size={16} />
          {pendingAction === "recurring" ? "Salvando..." : "Salvar recorrencia"}
        </button>
      </form>

      <div className="excel-table-wrap">
        {recurring.length === 0 ? (
          <p className="empty-state">Nenhuma recorrencia cadastrada.</p>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("day")} type="button">
                    Dia <span>{indicator("day")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("type")} type="button">
                    Tipo <span>{indicator("type")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("description")} type="button">
                    Descricao <span>{indicator("description")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("category")} type="button">
                    Categoria <span>{indicator("category")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("amount")} type="button">
                    Valor <span>{indicator("amount")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("status")} type="button">
                    Status <span>{indicator("status")}</span>
                  </button>
                </th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const generated = recurringAlreadyGenerated(item);
                return (
                  <tr key={item.id}>
                    <td data-label="Dia">{item.day_of_month}</td>
                    <td data-label="Tipo">
                      <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
                    </td>
                    <td className="excel-table__description" data-label="Descricao">
                      {item.description}
                    </td>
                    <td data-label="Categoria">{categoryNameFor(item.category_id)}</td>
                    <td className={item.type === "entrada" ? "money-income" : "money-expense"} data-label="Valor">
                      {formatMoney(item.amount_cents)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          generated ? "status-pill success" : item.is_active ? "status-pill success" : "status-pill pending"
                        }
                      >
                        {generated ? "Gerada neste mes" : item.is_active ? "Ativa" : "Pausada"}
                      </span>
                    </td>
                    <td data-label="Acoes">
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          onClick={() => onGenerate(item)}
                          title="Gerar"
                          disabled={generated || isBusy}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => onEdit(item)}
                          title="Editar"
                          disabled={isBusy}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => onToggle(item)}
                          title={item.is_active ? "Pausar" : "Ativar"}
                          disabled={isBusy}
                        >
                          {item.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => onDelete(item.id)}
                          title="Apagar"
                          disabled={isBusy}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
