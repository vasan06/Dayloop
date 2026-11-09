import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHead, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton } from "../components/ui";
import { Donut } from "../components/charts";
import { PALETTE, spendingByCategory } from "../lib/derive";
import { useBudgets, useCategories, useCreateBudget, useCreateCategory, useCreateSavings, useCreateTransaction, useDeleteTransaction, useSavings, useSummary, useTransactions } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { isoDate, money, num, shortDate } from "../lib/format";
import type { Transaction } from "../lib/types";

export default function Finance() {
  const summary = useSummary();
  const txs = useTransactions();
  const cats = useCategories();
  const budgets = useBudgets();
  const savings = useSavings();
  const createTx = useCreateTransaction();
  const createCat = useCreateCategory();
  const createBudget = useCreateBudget();
  const createSaving = useCreateSavings();
  const remove = useDeleteTransaction();
  const [isNew, closeNew, showNew] = useNewParam();
  const [modal, setModal] = useState<"budget" | "saving" | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? "Uncategorised";
  const list = (txs.data ?? []).filter((t) => filter === "all" || t.transaction_type === filter);
  const spend = spendingByCategory(txs.data ?? [], cats.data ?? []).slice(0, 6);
  const month = new Date();
  const monthStart = isoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  async function saveTx(v: Record<string, string>) {
    let categoryId: string | null = null;
    const name = v.category.trim();
    if (name) {
      const existing = cats.data?.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.category_type === v.transaction_type);
      if (existing) categoryId = existing.id;
      else { const made = await createCat.mutateAsync({ name, category_type: v.transaction_type as "income" | "expense" }) as { item: { id: string } }; categoryId = made.item.id; }
    }
    createTx.mutate({ transaction_type: v.transaction_type, amount: v.amount, description: v.description, transaction_date: v.transaction_date || isoDate(), category_id: categoryId }, { onSuccess: closeNew });
  }

  return (
    <>
      <PageHead title="Finance" sub="Track income, spending, budgets and savings">
        <button className="btn" onClick={() => setModal("budget")}>Budget</button>
        <button className="btn" onClick={() => setModal("saving")}>Savings goal</button>
        <button className="btn pri" onClick={showNew}><Plus className="ic" />Transaction</button>
      </PageHead>
      <div className="g">
        <Card tone="mint" className="s4"><div className="mono">Income · {summary.data?.month}</div><div className="big">{money(summary.data?.income)}</div></Card>
        <Card tone="blush" className="s4"><div className="mono">Expenses</div><div className="big">{money(summary.data?.expenses)}</div></Card>
        <Card tone="sky" className="s4"><div className="mono">Net</div><div className="big">{money(summary.data?.net)}</div></Card>

        <Card className="s7">
          <CardHead title="Transactions" right={<div className="tabs" style={{ margin: 0 }}>{(["all", "income", "expense"] as const).map((k) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : k === "income" ? "Income" : "Expenses"}</button>)}</div>} />
          {txs.isLoading ? <Skeleton rows={5} /> : txs.isError ? <ErrorBox error={txs.error} retry={() => void txs.refetch()} /> : list.length === 0 ? <Empty title="No transactions" hint="Log income or an expense to get started." action={<button className="btn pri sm" onClick={showNew}>Add transaction</button>} /> : (
            <div className="tw"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr></thead><tbody>{list.slice(0, 60).map((t) => (
              <tr key={t.id}><td className="mono">{shortDate(t.transaction_date + "T00:00")}</td><td>{t.description || "—"}</td><td><span className="pill">{catName(t.category_id)}</span></td>
                <td className="num" style={{ textAlign: "right", color: t.transaction_type === "income" ? "var(--green)" : "var(--ink)" }}>{t.transaction_type === "income" ? "+" : "−"}{money(t.amount, t.currency)}</td>
                <td><button className="iconbtn" style={{ width: 30, height: 30 }} aria-label="Remove transaction" onClick={() => setDeleting(t)}><Trash2 className="ic" style={{ width: 14, height: 14 }} /></button></td></tr>
            ))}</tbody></table></div>
          )}
        </Card>
        <div className="s5" style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <Card><CardHead mono="This month" title="Spending mix" />{spend.length ? <div className="rg" style={{ flexWrap: "wrap", justifyContent: "space-around" }}><Donut size={150} slices={spend.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} center={money(spend.reduce((a, s) => a + s.value, 0))} sub="spent" /><ul>{spend.map((s, i) => <li key={s.label}><i style={{ background: PALETTE[i % PALETTE.length] }} />{s.label}</li>)}</ul></div> : <Empty title="No spending yet" hint="Expenses appear here." />}</Card>
          <Card><CardHead title="Budgets" />{(budgets.data ?? []).length === 0 ? <Empty title="No budgets" hint="Set a monthly limit to stay on track." /> : <div className="list">{budgets.data!.map((b) => { const pct = num(b.total_limit) ? (num(b.spent) / num(b.total_limit)) * 100 : 0; return <div key={b.id} className="li" style={{ display: "block" }}><div className="row sb"><b>{b.name}</b><span className="mono">{money(b.spent, b.currency)} / {money(b.total_limit, b.currency)}</span></div><Progress value={pct} color={pct > 100 ? "var(--rose)" : pct > 80 ? "var(--amber)" : undefined} /></div>; })}</div>}</Card>
          <Card><CardHead title="Savings goals" />{(savings.data ?? []).length === 0 ? <Empty title="No savings goals" hint="Name something you're saving for." /> : <div className="list">{savings.data!.map((s) => <div key={s.id} className="li" style={{ display: "block" }}><div className="row sb"><b>{s.name}</b><span className="mono">{money(s.current_amount, s.currency)} / {money(s.target_amount, s.currency)}</span></div><Progress value={(num(s.current_amount) / Math.max(1, num(s.target_amount))) * 100} /></div>)}</div>}</Card>
        </div>
      </div>

      {isNew && <FormModal title="Add transaction" busy={createTx.isPending} onClose={closeNew} initial={{ transaction_date: isoDate(), transaction_type: "expense" }} fields={[{ name: "transaction_type", label: "Type", type: "select", options: [["expense", "Expense"], ["income", "Income"]], half: true }, { name: "amount", label: "Amount (₹)", type: "number", step: "0.01", min: 0, required: true, half: true }, { name: "description", label: "Description" }, { name: "category", label: "Category", placeholder: "Food, Rent, Salary…", half: true }, { name: "transaction_date", label: "Date", type: "date", half: true }]} onSubmit={(v) => void saveTx(v)} />}
      {modal === "budget" && <FormModal title="New budget" busy={createBudget.isPending} onClose={() => setModal(null)} initial={{ period_start: monthStart, period_end: monthEnd }} fields={[{ name: "name", label: "Name", required: true, placeholder: "November spending" }, { name: "total_limit", label: "Limit (₹)", type: "number", step: "0.01", required: true }, { name: "period_start", label: "From", type: "date", half: true, required: true }, { name: "period_end", label: "To", type: "date", half: true, required: true }]} onSubmit={(v) => createBudget.mutate({ ...v, period_type: "monthly" }, { onSuccess: () => setModal(null) })} />}
      {modal === "saving" && <FormModal title="New savings goal" busy={createSaving.isPending} onClose={() => setModal(null)} fields={[{ name: "name", label: "Name", required: true }, { name: "target_amount", label: "Target (₹)", type: "number", step: "0.01", required: true, half: true }, { name: "target_date", label: "By", type: "date", half: true }]} onSubmit={(v) => createSaving.mutate({ name: v.name, target_amount: v.target_amount, target_date: v.target_date || null }, { onSuccess: () => setModal(null) })} />}
      {deleting && <ConfirmModal title="Remove transaction?" body="It will no longer count toward your totals." confirm="Remove" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
