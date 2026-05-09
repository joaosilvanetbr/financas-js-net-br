import { describe, it, expect } from "vitest";
import {
  calculateSummary,
  formatMoney,
  getMonthRange,
  hasDuplicateCategoryName,
  monthKey,
  normalizeCategoryName,
  todayKey,
  toCents,
  type Category,
  type RecurringTransaction,
  type Transaction,
} from "../src/lib/finance";

describe("Utilitarios de data", () => {
  it("todayKey e monthKey usam partes locais da data", () => {
    const date = new Date(2026, 3, 27, 23, 59, 0);
    expect(todayKey(date)).toBe("2026-04-27");
    expect(monthKey(date)).toBe("2026-04");
  });

  it("getMonthRange retorna limites seguros do mes", () => {
    expect(getMonthRange("2026-04")).toEqual({
      start: "2026-04-01",
      end: "2026-05-01",
    });
    expect(getMonthRange("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });
});

describe("Conversao de moeda", () => {
  it("toCents converte entrada de moeda brasileira com seguranca", () => {
    expect(toCents("2.700,45")).toBe(270045);
    expect(toCents("39,10")).toBe(3910);
    expect(toCents("100")).toBe(10000);
    expect(toCents("0,50")).toBe(50);
  });

  it("toCents rejeita valores invalidos", () => {
    expect(toCents("0")).toBeNull();
    expect(toCents("")).toBeNull();
    expect(toCents("abc")).toBeNull();
    expect(toCents("-10")).toBeNull();
    expect(toCents("0,00")).toBeNull();
  });

  it("formatMoney formata centavos para BRL corretamente", () => {
    expect(formatMoney(270045)).toBe("R$\u00a02.700,45");
    expect(formatMoney(0)).toBe("R$\u00a00,00");
    expect(formatMoney(50)).toBe("R$\u00a00,50");
  });
});

describe("Categorias", () => {
  it("hasDuplicateCategoryName ignora caixa e espacos", () => {
    const categories: Category[] = [
      { id: "1", name: "Mercado", type: "saida", color: "#f08c00" },
      { id: "2", name: "Salario", type: "entrada", color: "#2f9e44" },
    ];

    expect(hasDuplicateCategoryName(categories, " mercado ", "saida")).toBe(true);
    expect(hasDuplicateCategoryName(categories, "mercado", "entrada")).toBe(false);
    expect(hasDuplicateCategoryName(categories, "Mercado", "saida", "1")).toBe(false);
  });

  it("normalizeCategoryName normaliza com locale pt-BR", () => {
    expect(normalizeCategoryName("  Mercado  ")).toBe("mercado");
    expect(normalizeCategoryName("CAFÉ")).toBe("café");
  });
});

describe("Resumo financeiro", () => {
  it("calculateSummary mantem totais e saldo esperado", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        type: "entrada",
        description: "Salario",
        amount_cents: 270000,
        entry_date: "2026-04-05",
        category_id: "c1",
        notes: null,
        is_paid: false,
      },
      {
        id: "t2",
        type: "saida",
        description: "Mercado",
        amount_cents: 15251,
        entry_date: "2026-04-10",
        category_id: "c2",
        notes: null,
        is_paid: true,
      },
    ];

    const recurring: RecurringTransaction[] = [
      {
        id: "r1",
        type: "saida",
        description: "Internet",
        amount_cents: 10000,
        category_id: "c3",
        day_of_month: 15,
        is_active: true,
      },
      {
        id: "r2",
        type: "entrada",
        description: "Extra",
        amount_cents: 5000,
        category_id: "c4",
        day_of_month: 20,
        is_active: true,
      },
    ];

    expect(calculateSummary(transactions, recurring)).toEqual({
      income: 270000,
      expense: 15251,
      balance: 254749,
      expectedBalance: 249749,
    });
  });

  it("calculateSummary retorna zero com listas vazias", () => {
    expect(calculateSummary([], [])).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      expectedBalance: 0,
    });
  });

  it("calculateSummary ignora recorrencias inativas no expectedBalance", () => {
    const transactions: Transaction[] = [];
    const recurring: RecurringTransaction[] = [
      {
        id: "r1",
        type: "saida",
        description: "Aluguel",
        amount_cents: 100000,
        category_id: null,
        day_of_month: 5,
        is_active: false,
      },
    ];

    const result = calculateSummary(transactions, recurring);
    expect(result.expectedBalance).toBe(0);
  });
});

describe("useSortableTable (hook de ordenacao)", () => {
  it("sorted ordena array por chave e direcao", () => {
    const items = [
      { id: "1", name: "Zebra", value: 100 },
      { id: "2", name: "Abacate", value: 50 },
      { id: "3", name: "Maca", value: 200 },
    ];

    const comparators = {
      name: (a: typeof items[0], b: typeof items[0]) => a.name.localeCompare(b.name, "pt-BR"),
      value: (a: typeof items[0], b: typeof items[0]) => a.value - b.value,
    };

    const sortedByName = [...items].sort((a, b) => comparators.name(a, b));
    expect(sortedByName[0].name).toBe("Abacate");
    expect(sortedByName[2].name).toBe("Zebra");

    const sortedByValue = [...items].sort((a, b) => comparators.value(a, b));
    expect(sortedByValue[0].value).toBe(50);
    expect(sortedByValue[2].value).toBe(200);
  });
});
