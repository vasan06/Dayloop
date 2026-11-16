import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import {
  Card,
  Empty,
  ErrorBox,
  FormModal,
  PageHead,
  Progress,
  Skeleton,
  type FieldDef,
} from "../components/ui";
import { Gauge } from "../components/charts";
import { useBudgets, useCreateBudget, useSummary } from "../hooks/data";
import { isoDate, money, num, shortDate, toneOf } from "../lib/format";

export default function Budgets() {
  const budgets = useBudgets();
  const summary = useSummary();
  const createBudget = useCreateBudget();

  const [isNewOpen, setIsNewOpen] = useState(false);

  const budgetList = budgets.data ?? [];

  // Month range defaults for new budget
  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  // Overall aggregates
  const totals = useMemo(() => {
    let limit = 0;
    let spent = 0;
    for (const b of budgetList) {
      limit += num(b.total_limit);
      spent += num(b.spent);
    }
    const remaining = limit - spent;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return { limit, spent, remaining, pct };
  }, [budgetList]);

  const fields: FieldDef[] = [
    { name: "name", label: "Budget Name", required: true, placeholder: "e.g. Dining & Groceries, Utilities" },
    { name: "total_limit", label: "Spending Limit (₹)", type: "number", step: "0.01", min: 0, required: true },
    {
      name: "period_type",
      label: "Period Type",
      type: "select",
      options: [
        ["monthly", "Monthly"],
        ["weekly", "Weekly"],
        ["quarterly", "Quarterly"],
        ["yearly", "Yearly"],
      ],
      half: true,
      required: true,
    },
    { name: "period_start", label: "Start Date", type: "date", half: true, required: true },
    { name: "period_end", label: "End Date", type: "date", half: true, required: true },
  ];

  const handleCreateBudget = (v: Record<string, string>) => {
    createBudget.mutate(
      {
        name: v.name.trim(),
        total_limit: v.total_limit,
        period_type: v.period_type,
        period_start: v.period_start,
        period_end: v.period_end,
      },
      {
        onSuccess: () => setIsNewOpen(false),
      }
    );
  };

  return (
    <>
      {/* Breadcrumb Navigation */}
      <div className="row mono" style={{ gap: 8, fontSize: 13, marginBottom: 8 }}>
        <Link to="/finance" className="lnk" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft className="ic" style={{ width: 14, height: 14 }} />
          Finance
        </Link>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>Budgets</span>
      </div>

      <PageHead title="Budgets" sub="Plan spending caps and monitor burn rates">
        <button className="btn pri" onClick={() => setIsNewOpen(true)}>
          <Plus className="ic" />
          New budget
        </button>
      </PageHead>

      {/* Hero Overview Gauge Card */}
      <div className="g" style={{ marginBottom: 20 }}>
        <Card className="s12" style={{ padding: "24px 28px" }}>
          <div className="row sb wrap" style={{ gap: 20 }}>
            <div style={{ flex: "1 1 320px" }}>
              <div className="mono" style={{ marginBottom: 6 }}>
                Aggregated Spending Cap · {summary.data?.month ?? "Current Period"}
              </div>
              <h2 style={{ fontSize: 26, margin: "0 0 10px" }}>Overall Budget Utilization</h2>
              <p className="mute" style={{ maxWidth: 480, margin: "0 0 16px" }}>
                {totals.remaining >= 0
                  ? `You have ${money(totals.remaining)} remaining across all configured budget envelopes.`
                  : `Spending has exceeded overall planned caps by ${money(Math.abs(totals.remaining))}.`}
              </p>

              <div className="row wrap" style={{ gap: 16 }}>
                <div>
                  <div className="mono sm mute">Total Cap</div>
                  <div className="big">{money(totals.limit)}</div>
                </div>
                <div style={{ width: 1, background: "var(--line)", height: 38 }} />
                <div>
                  <div className="mono sm mute">Total Spent</div>
                  <div className="big" style={{ color: totals.pct > 100 ? "var(--rose)" : "inherit" }}>
                    {money(totals.spent)}
                  </div>
                </div>
                <div style={{ width: 1, background: "var(--line)", height: 38 }} />
                <div>
                  <div className="mono sm mute">
                    {totals.remaining >= 0 ? "Remaining" : "Over Budget"}
                  </div>
                  <div
                    className="big"
                    style={{ color: totals.remaining >= 0 ? "var(--green)" : "var(--rose)" }}
                  >
                    {money(Math.abs(totals.remaining))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ minWidth: 200, textAlign: "center" }}>
              <div style={{ maxWidth: 210, margin: "0 auto" }}>
                <Gauge value={totals.pct} label="Used" />
              </div>
              <div className="mono sm mute" style={{ marginTop: 4 }}>
                {totals.pct.toFixed(1)}% of planned ceiling
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Category-by-Category Budgets Section */}
      <div className="row sb wrap" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Category & Envelope Budgets</h2>
          <div className="mute sm">Individual spending allowances</div>
        </div>
      </div>

      {budgets.isLoading ? (
        <Card><Skeleton rows={5} /></Card>
      ) : budgets.isError ? (
        <ErrorBox error={budgets.error} retry={() => void budgets.refetch()} />
      ) : budgetList.length === 0 ? (
        <Card>
          <Empty
            title="No budgets created yet"
            hint="Set a spending cap for groceries, entertainment, rent or shopping."
            action={
              <button className="btn pri sm" onClick={() => setIsNewOpen(true)}>
                <Plus className="ic" style={{ width: 14, height: 14 }} />
                Create your first budget
              </button>
            }
          />
        </Card>
      ) : (
        <div className="pc">
          {budgetList.map((b, i) => {
            const limit = num(b.total_limit);
            const spent = num(b.spent);
            const diff = limit - spent;
            const isOver = diff < 0;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const tone = toneOf(b.id);

            return (
              <Card key={b.id} i={i} tone={tone}>
                <div className="row sb" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{b.name}</h3>
                  {isOver ? (
                    <span className="pill hi">
                      <AlertTriangle className="ic" style={{ width: 12, height: 12 }} />
                      Over by {money(Math.abs(diff), b.currency)}
                    </span>
                  ) : (
                    <span className="pill ok">
                      {money(diff, b.currency)} left
                    </span>
                  )}
                </div>

                <div className="mono sm mute" style={{ marginBottom: 12 }}>
                  {b.period_type} · {shortDate(b.period_start)} – {shortDate(b.period_end)}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Progress
                    value={pct}
                    color={pct > 100 ? "var(--rose)" : pct > 85 ? "var(--amber)" : undefined}
                  />
                </div>

                <div className="row sb sm" style={{ marginTop: 8 }}>
                  <span className="mute">
                    Spent: <b style={{ color: "var(--ink)" }}>{money(spent, b.currency)}</b>
                  </span>
                  <span className="mono">
                    Limit: {money(limit, b.currency)} ({Math.round(pct)}%)
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Budget Modal */}
      {isNewOpen && (
        <FormModal
          title="New budget"
          submit="Create budget"
          fields={fields}
          busy={createBudget.isPending}
          onClose={() => setIsNewOpen(false)}
          initial={{
            period_type: "monthly",
            period_start: monthStart,
            period_end: monthEnd,
          }}
          onSubmit={handleCreateBudget}
        />
      )}
    </>
  );
}
