import { Pencil, Trash2 } from "lucide-react";
import { Category, CategoryLimit, formatMoney, Transaction } from "../../../lib/finance";
import { useSortableTable } from "../../../hooks/useSortableTable";

type LimitRow = {
  category: Category;
  limit: CategoryLimit | undefined;
  spent: number;
  percent: number;
};

type LimitesTabProps = {
  categories: Category[];
  categoryLimits: CategoryLimit[];
  transactions: Transaction[];
  isBusy: boolean;
  onEdit: (categoryId: string, currentLimit?: CategoryLimit) => void;
  onDelete: (id: string) => void;
};

type LimitSortKey = "category" | "spent" | "limit" | "usage" | "status";

export function LimitesTab({
  categories,
  categoryLimits,
  transactions,
  isBusy,
  onEdit,
  onDelete,
}: LimitesTabProps) {
  const expenseCategories = categories.filter((item) => item.type === "saida");
  const monthExpenses = transactions.filter((item) => item.type === "saida");

  const limitRows: LimitRow[] = expenseCategories.map((category) => {
    const limit = categoryLimits.find((item) => item.category_id === category.id);
    const spent = monthExpenses
      .filter((item) => item.category_id === category.id)
      .reduce((total, item) => total + item.amount_cents, 0);
    return {
      category,
      limit,
      spent,
      percent: limit ? Math.min(100, Math.round((spent / limit.amount_cents) * 100)) : 0,
    };
  });

  const { sortKey, sortDirection, toggleSort, indicator } = useSortableTable<LimitSortKey>("category");

  const sorted = [...limitRows].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    let result = 0;
    if (sortKey === "category") result = a.category.name.localeCompare(b.category.name, "pt-BR");
    if (sortKey === "spent") result = a.spent - b.spent;
    if (sortKey === "limit") result = (a.limit?.amount_cents ?? 0) - (b.limit?.amount_cents ?? 0);
    if (sortKey === "usage") result = a.percent - b.percent;
    if (sortKey === "status") {
      const statusFor = (row: LimitRow) =>
        !row.limit ? "sem limite" : row.spent > row.limit.amount_cents ? "passou" : "ok";
      result = statusFor(a).localeCompare(statusFor(b), "pt-BR");
    }
    return result * dir;
  });

  return (
    <section className="tab-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controle mensal</p>
          <h2>Limites por categoria</h2>
        </div>
      </div>

      <div className="excel-table-wrap">
        {limitRows.length === 0 ? (
          <p className="empty-state">Crie categorias de saida para definir limites.</p>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("category")} type="button">
                    Categoria <span>{indicator("category")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("spent")} type="button">
                    Gasto <span>{indicator("spent")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("limit")} type="button">
                    Limite <span>{indicator("limit")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("usage")} type="button">
                    Uso <span>{indicator("usage")}</span>
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
              {sorted.map(({ category, limit, spent, percent }) => {
                const exceeded = Boolean(limit && spent > limit.amount_cents);
                return (
                  <tr key={category.id}>
                    <td className="excel-table__description" data-label="Categoria">
                      {category.name}
                    </td>
                    <td data-label="Gasto">{formatMoney(spent)}</td>
                    <td data-label="Limite">{limit ? formatMoney(limit.amount_cents) : "Sem limite"}</td>
                    <td data-label="Uso">
                      <div className="table-meter" aria-label={`Uso do limite de ${category.name}`}>
                        <span className={exceeded ? "exceeded" : ""} style={{ width: limit ? `${percent}%` : "0%" }} />
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={exceeded ? "status-pill pending" : "status-pill success"}>
                        {limit
                          ? exceeded
                            ? `Passou ${formatMoney(spent - limit.amount_cents)}`
                            : `Resta ${formatMoney(limit.amount_cents - spent)}`
                          : "Sem limite"}
                      </span>
                    </td>
                    <td data-label="Acoes">
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          onClick={() => onEdit(category.id, limit)}
                          title="Editar limite"
                          disabled={isBusy}
                        >
                          <Pencil size={16} />
                        </button>
                        {limit && (
                          <button
                            className="icon-button"
                            onClick={() => onDelete(limit.id)}
                            title="Remover limite"
                            disabled={isBusy}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
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
