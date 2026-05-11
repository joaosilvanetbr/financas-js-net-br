import { Skeleton } from "../Skeleton";

type DashboardTab =
  | "resumo"
  | "lancamentos"
  | "recorrencias"
  | "categorias"
  | "limites"
  | "relatorios"
  | "configuracoes";

export function DashboardSkeleton({ activeTab }: { activeTab: DashboardTab }) {
  switch (activeTab) {
    case "resumo":
      return (
        <section className="tab-panel">
          <div className="skeleton-summary">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
          <div className="panel skeleton-panel">
            <Skeleton rows={8} />
          </div>
        </section>
      );

    case "lancamentos":
      return (
        <section className="tab-panel panel">
          <div className="skeleton-form">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
          <Skeleton rows={10} />
        </section>
      );

    case "recorrencias":
      return (
        <section className="tab-panel panel">
          <div className="skeleton-form">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
          <Skeleton rows={8} />
        </section>
      );

    case "categorias":
      return (
        <section className="tab-panel panel">
          <div className="skeleton-grid">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      );

    case "limites":
      return (
        <section className="tab-panel panel">
          <div className="skeleton-grid">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      );

    case "relatorios":
      return (
        <section className="tab-panel">
          <div className="report-hero panel">
            <Skeleton rows={3} />
          </div>
          <div className="skeleton-summary">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
          <div className="report-grid">
            <div className="panel skeleton-panel">
              <Skeleton rows={6} />
            </div>
            <div className="panel skeleton-panel">
              <Skeleton rows={6} />
            </div>
            <div className="panel skeleton-panel">
              <Skeleton rows={6} />
            </div>
            <div className="panel skeleton-panel">
              <Skeleton rows={6} />
            </div>
          </div>
        </section>
      );

    case "configuracoes":
      return (
        <section className="tab-panel panel">
          <div className="settings-grid">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      );

    default:
      return (
        <section className="tab-panel panel">
          <Skeleton rows={6} />
        </section>
      );
  }
}
