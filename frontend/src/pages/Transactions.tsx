import TransactionForm from "../components/TransactionForm";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Search, Trash2, Wallet } from "lucide-react";
import {
  Card,
  ConfirmModal,
  Empty,
  ErrorBox,
  PageHead,
  Skeleton,
} from "../components/ui";
import {
  useCategories,
  useDeleteTransaction,
  useTransactions,
} from "../hooks/data";
import { money, num, shortDate } from "../lib/format";
import type { Transaction } from "../lib/types";

type TabType = "all" | "income" | "expense";

export default function Transactions() {
  const txs = useTransactions();
  const cats = useCategories();
  const deleteTx = useDeleteTransaction();

  const [tab, setTab] = useState<TabType>("all");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const categories = cats.data ?? [];
  const allTxs = txs.data ?? [];

  const [currency, setCurrency] = useState("INR");
  const currencies = [...new Set(["INR", ...allTxs.map((item) => item.currency)])].sort();

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
      if (t.currency !== currency) continue;
      const val = Math.round(num(t.amount) * 100);
      if (t.transaction_type === "income") income += val;
      else expense += val;
    }
    return { income: income / 100, expense: expense / 100, net: (income - expense) / 100 };
  }, [allTxs, currency]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTxs
      .filter((t) => {
        if (t.currency !== currency) return false;
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
  }, [allTxs, currency, tab, selectedCat, searchQuery, catMap]);

  return (
    <>

      <PageHead title="Transactions" sub={`${allTxs.length} recent entries`}>
        {currencies.length > 1 && <select className="btn" aria-label="Transaction currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
          {currencies.map((code) => <option key={code}>{code}</option>)}
        </select>}
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
          <div className="big" style={{ marginTop: 4 }}>{money(totals.income, currency)}</div>
        </Card>
        <Card tone="blush" className="s4">
          <div className="row sb">
            <div className="mono">Total Expenses</div>
            <ArrowUpRight className="ic" style={{ color: "var(--rose)" }} />
          </div>
          <div className="big" style={{ marginTop: 4 }}>{money(totals.expense, currency)}</div>
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
            {money(totals.net, currency)}
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

      {isNewOpen && <TransactionForm currency={currency} onClose={() => setIsNewOpen(false)} />}

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
