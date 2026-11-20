import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Search, Trash2, Wallet } from "lucide-react";
import {
  Card,
  ConfirmModal,
  Empty,
  ErrorBox,
  FormModal,
  PageHead,
  Skeleton,
  type FieldDef,
} from "../components/ui";
import {
  useCategories,
  useCreateCategory,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from "../hooks/data";
import { isoDate, money, num, shortDate } from "../lib/format";
import type { Transaction } from "../lib/types";

type TabType = "all" | "income" | "expense";

export default function Transactions() {
  const txs = useTransactions();
  const cats = useCategories();
  const createTx = useCreateTransaction();
  const createCat = useCreateCategory();
  const deleteTx = useDeleteTransaction();

  const [tab, setTab] = useState<TabType>("all");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const categories = cats.data ?? [];
  const allTxs = txs.data ?? [];

  const catMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Aggregate metrics
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of allTxs) {
      const val = num(t.amount);
      if (t.transaction_type === "income") income += val;
      else expense += val;
    }
    return { income, expense, net: income - expense };
  }, [allTxs]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTxs
      .filter((t) => {
        if (tab !== "all" && t.transaction_type !== tab) return false;
        if (selectedCat !== "all" && t.category_id !== selectedCat) return false;
        if (q) {
          const catName = (catMap.get(t.category_id ?? "") ?? "").toLowerCase();
          const desc = (t.description ?? "").toLowerCase();
          const amt = String(t.amount);
          if (!desc.includes(q) && !catName.includes(q) && !amt.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => (b.transaction_date ?? "").localeCompare(a.transaction_date ?? ""));
  }, [allTxs, tab, selectedCat, searchQuery, catMap]);

  const catOptions: [string, string][] = [
    ["", "None / Uncategorised"],
    ...categories.map((c) => [c.id, `${c.name} (${c.category_type})`] as [string, string]),
  ];

  const fields: FieldDef[] = [
    {
      name: "transaction_type",
      label: "Type",
      type: "select",
      options: [
        ["expense", "Expense (−)"],
        ["income", "Income (+)"],
      ],
      half: true,
      required: true,
    },
    {
      name: "amount",
      label: "Amount (₹)",
      type: "number",
      step: "0.01",
      min: 0,
      required: true,
      half: true,
    },
    { name: "description", label: "Description", placeholder: "e.g. Grocery shopping, Freelance payout" },
    {
      name: "category_id",
      label: "Existing Category",
      type: "select",
      options: catOptions,
      half: true,
    },
    {
      name: "new_category",
      label: "Or New Category",
      type: "text",
      placeholder: "e.g. Groceries, Software",
      half: true,
    },
    {
      name: "transaction_date",
      label: "Transaction Date",
      type: "date",
      half: true,
      required: true,
    },
  ];

  const handleCreateSubmit = async (v: Record<string, string>) => {
    let categoryId: string | null = v.category_id || null;

    if (v.new_category && v.new_category.trim()) {
      const catName = v.new_category.trim();
      const existing = categories.find(
        (c) => c.name.toLowerCase() === catName.toLowerCase() && c.category_type === v.transaction_type
      );
      if (existing) {
        categoryId = existing.id;
      } else {
        const created = (await createCat.mutateAsync({
          name: catName,
          category_type: v.transaction_type as "income" | "expense",
        })) as { item: { id: string } };
        categoryId = created.item.id;
      }
    }

    createTx.mutate(
      {
        transaction_type: v.transaction_type,
        amount: v.amount,
        description: v.description,
        transaction_date: v.transaction_date || isoDate(),
        category_id: categoryId,
        currency: "INR",
      },
      {
        onSuccess: () => setIsNewOpen(false),
      }
    );
  };

  return (
    <>

      <PageHead title="Transactions" sub={`${allTxs.length} recorded entries`}>
        <button className="btn pri" onClick={() => setIsNewOpen(true)}>
          <Plus className="ic" />
          Add transaction
        </button>
      </PageHead>

      {/* Financial Overview Cards */}
      <div className="g" style={{ marginBottom: 16 }}>
        <Card tone="mint" className="s4">
          <div className="row sb">
            <div className="mono">Total Income</div>
            <ArrowDownLeft className="ic" style={{ color: "var(--green)" }} />
          </div>
          <div className="big" style={{ marginTop: 4 }}>{money(totals.income)}</div>
        </Card>
        <Card tone="blush" className="s4">
          <div className="row sb">
            <div className="mono">Total Expenses</div>
            <ArrowUpRight className="ic" style={{ color: "var(--rose)" }} />
          </div>
          <div className="big" style={{ marginTop: 4 }}>{money(totals.expense)}</div>
        </Card>
        <Card tone="sky" className="s4">
          <div className="row sb">
            <div className="mono">Net Balance</div>
            <Wallet className="ic" style={{ color: "var(--acc)" }} />
          </div>
          <div
            className="big"
            style={{ marginTop: 4, color: totals.net >= 0 ? "inherit" : "var(--rose)" }}
          >
            {money(totals.net)}
          </div>
        </Card>
      </div>

      {/* Main Transactions List */}
      <Card>
        <div className="row wrap" style={{ marginBottom: 14, gap: 10 }}>
          {/* Filter tabs */}
          <div className="tabs" style={{ margin: 0 }}>
            {(["all", "income", "expense"] as TabType[]).map((t) => (
              <button
                key={t}
                className={tab === t ? "on" : ""}
                onClick={() => setTab(t)}
              >
                {t === "all" ? "All" : t === "income" ? "Income" : "Expenses"}
              </button>
            ))}
          </div>

          {/* Category filter dropdown */}
          <select
            className="btn"
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div style={{ flex: 1 }} />

          {/* Search filter input */}
          <label className="search" style={{ minWidth: 220 }}>
            <Search className="ic" />
            <input
              placeholder="Search description, category, amount…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search transactions"
            />
          </label>
        </div>

        {txs.isLoading ? (
          <Skeleton rows={6} />
        ) : txs.isError ? (
          <ErrorBox error={txs.error} retry={() => void txs.refetch()} />
        ) : filtered.length === 0 ? (
          <Empty
            title={allTxs.length ? "No matching transactions" : "No transactions recorded yet"}
            hint={
              allTxs.length
                ? "Try adjusting your search query or category filter."
                : "Record your first expense or income entry."
            }
            action={
              <button className="btn pri sm" onClick={() => setIsNewOpen(true)}>
                <Plus className="ic" style={{ width: 14, height: 14 }} />
                Add transaction
              </button>
            }
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right", width: 140 }}>Amount</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const isInc = t.transaction_type === "income";
                  const catName = catMap.get(t.category_id ?? "") ?? "Uncategorised";
                  return (
                    <tr key={t.id}>
                      <td className="mono sm" style={{ color: "var(--mute)" }}>
                        {shortDate(t.transaction_date + "T00:00:00")}
                      </td>
                      <td>
                        <b style={{ fontWeight: 500 }}>{t.description || "Untitled entry"}</b>
                      </td>
                      <td>
                        <span className={`pill ${isInc ? "ok" : ""}`}>{catName}</span>
                      </td>
                      <td
                        className="num"
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          color: isInc ? "var(--green)" : "var(--ink)",
                        }}
                      >
                        {isInc ? "+" : "−"}
                        {money(t.amount, t.currency || "INR")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="iconbtn"
                          style={{ width: 30, height: 30 }}
                          aria-label={`Delete transaction ${t.description}`}
                          onClick={() => setDeletingTx(t)}
                        >
                          <Trash2 className="ic" style={{ width: 14, height: 14 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Transaction Form Modal */}
      {isNewOpen && (
        <FormModal
          title="Add transaction"
          submit="Save transaction"
          fields={fields}
          busy={createTx.isPending || createCat.isPending}
          onClose={() => setIsNewOpen(false)}
          initial={{
            transaction_type: "expense",
            transaction_date: isoDate(),
            category_id: "",
          }}
          onSubmit={(v) => void handleCreateSubmit(v)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <ConfirmModal
          title="Delete transaction?"
          body={`Remove ${money(deletingTx.amount, deletingTx.currency)} (${deletingTx.description || "transaction"}) from your records?`}
          confirm="Delete"
          onConfirm={() => {
            deleteTx.mutate(deletingTx.id);
            setDeletingTx(null);
          }}
          onClose={() => setDeletingTx(null)}
        />
      )}
    </>
  );
}
