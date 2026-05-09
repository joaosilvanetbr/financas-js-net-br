import { RefreshCw } from "lucide-react";
import { formatMoney, Transaction, RecurringTransaction, calculateSummary } from "../../../lib/finance";
import { SummaryCard } from "../SummaryCard";
import { TransactionCards } from "../TransactionCards";

type ResumoTabProps = {
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  loading: boolean;
  isBusy: boolean;
  pendingAction: string | null;
  onRefresh: () => void;
  categoryNameFor: (id: string | null) => string;
  onDelete: (id: string) => void;
  onEdit: (item: Transaction) => void;
  onTogglePaid: (item: Transaction) => void;
};

export function ResumoTab({
  transactions,
  recurring,
  loading,
  isBusy,
  pendingAction,
  onRefresh,
  categoryNameFor,
  onDelete,
  onEdit,
  onTogglePaid,
}: ResumoTabProps) {
  const summary = calculateSummary(transactions, recurring);
  const monthExpenses = transactions.filter((item) => item.type === "saida");

  return (
    <section className="tab-panel">
      <section className="summary-grid">
        <SummaryCard title="Entradas" value={formatMoney(summary.income)} tone="income" />
        <SummaryCard title="Saidas" value={formatMoney(summary.expense)} tone="expense" />
        <SummaryCard title="Saldo" value={formatMoney(summary.balance)} tone="balance" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Mes filtrado</p>
            <h2>Saidas do mes</h2>
          </div>
          <button className="ghost-button" onClick={onRefresh} disabled={isBusy}>
            <RefreshCw size={16} />
            {pendingAction === "refresh" ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        <TransactionCards
          transactions={monthExpenses}
          loading={loading}
          categoryNameFor={categoryNameFor}
          deleteTransaction={onDelete}
          editTransaction={onEdit}
          togglePaid={onTogglePaid}
          emptyMessage="Nenhuma saida neste mes."
          isBusy={isBusy}
        />
      </section>
    </section>
  );
}
