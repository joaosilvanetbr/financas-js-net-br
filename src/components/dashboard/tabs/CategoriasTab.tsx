import { FormEvent, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Category,
  EntryType,
  hasDuplicateCategoryName,
  normalizeCategoryName,
  sortCategories,
} from "../../../lib/finance";
import { useSortableTable } from "../../../hooks/useSortableTable";

type CategoriasTabProps = {
  categories: Category[];
  isBusy: boolean;
  pendingAction: string | null;
  onAdd: (data: { name: string; type: EntryType; color: string }) => Promise<{ data?: Category | null; error?: any }>;
  onDelete: (id: string) => void;
  onEdit: (item: Category) => void;
  onSetCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

type CategorySortKey = "type" | "name";

const palette = ["#2f9e44", "#1971c2", "#f08c00", "#7048e8", "#d6336c", "#0ca678"];

function isDuplicateCategoryError(error: { code?: string } | null) {
  return error?.code === "23505";
}

export function CategoriasTab({
  categories,
  isBusy,
  pendingAction,
  onAdd,
  onDelete,
  onEdit,
  onSetCategories,
}: CategoriasTabProps) {
  const [activeType, setActiveType] = useState<EntryType>("saida");
  const [categoryName, setCategoryName] = useState("");
  const { sortKey, sortDirection, toggleSort, indicator } = useSortableTable<CategorySortKey>("name");

  const visible = categories.filter((item) => item.type === activeType);

  const sorted = [...visible].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const result =
      sortKey === "type"
        ? a.type.localeCompare(b.type, "pt-BR")
        : a.name.localeCompare(b.name, "pt-BR");
    return result * dir;
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy || !categoryName.trim()) return;

    if (hasDuplicateCategoryName(categories, categoryName, activeType)) return;

    const { data, error } = await onAdd({
      name: categoryName.trim(),
      type: activeType,
      color: palette[categories.length % palette.length],
    });

    if (error || !data) return;

    onSetCategories((current) => sortCategories([...current, data]));
    setCategoryName("");
  }

  return (
    <section className="tab-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Organizacao</p>
          <h2>Categorias</h2>
        </div>
      </div>

      <div className="subtabbar" aria-label="Tipo de categoria">
        <button className={activeType === "saida" ? "active" : ""} onClick={() => setActiveType("saida")}>
          Saidas
        </button>
        <button className={activeType === "entrada" ? "active" : ""} onClick={() => setActiveType("entrada")}>
          Entradas
        </button>
      </div>

      <form className="category-form card-form" onSubmit={handleSubmit}>
        <input
          placeholder={`Nova categoria de ${activeType === "entrada" ? "entrada" : "saida"}`}
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <button className="primary-button" disabled={isBusy}>
          <Plus size={16} />
          {pendingAction === "category" ? "Adicionando..." : "Adicionar"}
        </button>
      </form>

      <div className="excel-table-wrap">
        {visible.length === 0 ? (
          <p className="empty-state">Nenhuma categoria neste grupo.</p>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("type")} type="button">
                    Tipo <span>{indicator("type")}</span>
                  </button>
                </th>
                <th>
                  <button className="table-sort-button" onClick={() => toggleSort("name")} type="button">
                    Categoria <span>{indicator("name")}</span>
                  </button>
                </th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
                  </td>
                  <td className="excel-table__description">{item.name}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        onClick={() =>
                          onEdit({
                            ...item,
                          })
                        }
                        title="Editar"
                        disabled={isBusy}
                      >
                        <Pencil size={16} />
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
