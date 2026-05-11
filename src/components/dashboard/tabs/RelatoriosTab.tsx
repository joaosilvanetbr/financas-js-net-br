import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import {
  Category,
  CategoryLimit,
  formatMoney,
  calculateSummary,
  Transaction,
  RecurringTransaction,
} from "../../../lib/finance";
import { SummaryCard } from "../SummaryCard";

type RelatoriosTabProps = {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  generatedRecurringIds?: Set<string>;
  categories: Category[];
  categoryLimits: CategoryLimit[];
  selectedMonth: string;
  isBusy: boolean;
  onExportCSV: () => void;
  categoryNameFor: (id: string | null) => string;
};

function daysInMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

export function RelatoriosTab({
  transactions,
  recurring,
  generatedRecurringIds,
  categories,
  categoryLimits,
  selectedMonth,
  isBusy,
  onExportCSV,
  categoryNameFor,
}: RelatoriosTabProps) {
  const summary = calculateSummary(transactions, recurring, generatedRecurringIds);
  const expenseCategories = categories.filter((item) => item.type === "saida");
  const monthExpenses = transactions.filter((item) => item.type === "saida");

  const reportExpenseRows = expenseCategories
    .map((category) => {
      const spent = monthExpenses
        .filter((item) => item.category_id === category.id)
        .reduce((total, item) => total + item.amount_cents, 0);
      const limit = categoryLimits.find((item) => item.category_id === category.id);
      const limitPercent = limit ? Math.round((spent / limit.amount_cents) * 100) : 0;
      return { category, spent, limit, limitPercent };
    })
    .filter((item) => item.spent > 0 || item.limit)
    .sort((a, b) => b.spent - a.spent);

  const topExpenseCategory = reportExpenseRows.find((item) => item.spent > 0);
  const maxExpenseByCategory = Math.max(1, ...reportExpenseRows.map((item) => item.spent));
  const biggestExpenses = [...monthExpenses].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 5);
  const dailyExpenseRows = Array.from({ length: daysInMonthKey(selectedMonth) }, (_, index) => {
    const day = index + 1;
    const dayKey = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const spent = monthExpenses
      .filter((item) => item.entry_date === dayKey)
      .reduce((total, item) => total + item.amount_cents, 0);
    return { day, spent };
  }).filter((item) => item.spent > 0);
  const maxDailyExpense = Math.max(1, ...dailyExpenseRows.map((item) => item.spent));

  return (
    <section className="tab-panel">
      <section className="report-hero panel">
        <div>
          <p className="eyebrow">Analise mensal</p>
          <h2>Relatorios</h2>
          <p>Veja onde o dinheiro saiu no mes filtrado e quais categorias precisam de mais atencao.</p>
        </div>
        <button className="primary-button" onClick={onExportCSV} disabled={isBusy || transactions.length === 0}>
          Exportar CSV
        </button>
        <div className="report-highlight">
          <span>Maior categoria</span>
          <strong>{topExpenseCategory ? topExpenseCategory.category.name : "Sem gastos"}</strong>
          <small>{topExpenseCategory ? formatMoney(topExpenseCategory.spent) : "Nenhuma saida neste mes"}</small>
        </div>
      </section>

      <section className="summary-grid report-summary">
        <SummaryCard title="Entradas" value={formatMoney(summary.income)} tone="income" />
        <SummaryCard title="Saidas" value={formatMoney(summary.expense)} tone="expense" />
        <SummaryCard title="Saldo" value={formatMoney(summary.balance)} tone="balance" />
      </section>

      <section className="report-grid">
        <article className="panel report-panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Categorias</p>
              <h2>Gastos por categoria</h2>
            </div>
          </div>
          {reportExpenseRows.length === 0 ? (
            <p className="empty-state">Nenhuma saida para analisar neste mes.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px", alignItems: "start" }}>
              <div className="report-bars">
                {reportExpenseRows.map(({ category, spent }) => (
                  <div className="report-bar-row" key={category.id}>
                    <div className="report-bar-label">
                      <span>{category.name}</span>
                      <strong>{formatMoney(spent)}</strong>
                    </div>
                    <div className="report-track" aria-label={`Gasto em ${category.name}`}>
                      <span
                        style={{
                          width: `${Math.max(6, Math.round((spent / maxExpenseByCategory) * 100))}%`,
                          background: category.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportExpenseRows}
                      dataKey="spent"
                      nameKey="category.name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {reportExpenseRows.map(({ category }) => (
                        <Cell key={category.id} fill={category.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any) => formatMoney(Number(value)) as any}
                      labelFormatter={(_, payload: any) => payload?.[0]?.payload?.category?.name || ""}
                    />
                    <Legend verticalAlign="bottom" height={24} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </article>

        <article className="panel report-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Ranking</p>
              <h2>Maiores gastos</h2>
            </div>
          </div>
          {biggestExpenses.length === 0 ? (
            <p className="empty-state">Nenhum gasto neste mes.</p>
          ) : (
            <div className="expense-ranking">
              {biggestExpenses.map((item, index) => (
                <div className="ranking-row" key={item.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.description}</strong>
                    <small>{categoryNameFor(item.category_id)}</small>
                  </div>
                  <b>{formatMoney(item.amount_cents)}</b>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel report-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Limites</p>
              <h2>Status dos limites</h2>
            </div>
          </div>
          {reportExpenseRows.filter((item) => item.limit).length === 0 ? (
            <p className="empty-state">Cadastre limites para acompanhar alertas.</p>
          ) : (
            <div className="limit-status-list">
              {reportExpenseRows
                .filter((item) => item.limit)
                .map(({ category, spent, limit, limitPercent }) => {
                  const exceeded = Boolean(limit && spent > limit.amount_cents);
                  const closeToLimit = Boolean(limit && limitPercent >= 80);
                  return (
                    <div className="limit-status-row" key={category.id}>
                      <div>
                        <strong>{category.name}</strong>
                        <small>
                          {formatMoney(spent)} de {limit ? formatMoney(limit.amount_cents) : "R$ 0,00"}
                        </small>
                      </div>
                      <span className={exceeded ? "danger" : closeToLimit ? "warning" : "success"}>
                        {exceeded ? "Acima" : closeToLimit ? "Atencao" : "Ok"}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </article>

        <article className="panel report-panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Calendario</p>
              <h2>Evolucao diaria das saidas</h2>
            </div>
          </div>
          {dailyExpenseRows.length === 0 ? (
            <p className="empty-state">Nenhuma saida diaria para exibir.</p>
          ) : (
            <div className="daily-chart" aria-label="Gastos diarios do mes">
              {dailyExpenseRows.map((item) => (
                <div className="daily-column" key={item.day}>
                  <span style={{ height: `${Math.max(10, Math.round((item.spent / maxDailyExpense) * 100))}%` }} />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
