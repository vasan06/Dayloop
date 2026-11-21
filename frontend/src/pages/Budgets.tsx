import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
import { useBudgets, useCreateBudget } from "../hooks/data";
import { isoDate, money, num, shortDate, toneOf } from "../lib/format";

export default function Budgets() {
  const budgets = useBudgets();
  const createBudget = useCreateBudget();

  const [isNewOpen, setIsNewOpen] = useState(false);

  const budgetList = budgets.data ?? [];

  // Month range defaults for new budget
  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const fields: FieldDef[] = [
    { name: "name", label: "Budget Name", required: true, placeholder: "e.g. December spending" },
    { name: "total_limit", label: "Spending Limit (₹)", type: "number", step: "0.01", min: 0.01, required: true },
    {
      name: "period_type",
      label: "Period Type",
      type: "select",
      options: [
        ["monthly", "Monthly"],
        ["weekly", "Weekly"],
        ["custom", "Custom dates"],
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

      <PageHead title="Budgets" sub="Compare spending with the limit for each date range">
        <button className="btn pri" onClick={() => setIsNewOpen(true)}>
          <Plus className="ic" />
          New budget
        </button>
      </PageHead>

      {budgets.isLoading ? (
        <Card><Skeleton rows={5} /></Card>
      ) : budgets.isError ? (
        <ErrorBox error={budgets.error} retry={() => void budgets.refetch()} />
      ) : budgetList.length === 0 ? (
        <Card>
          <Empty
            title="No budgets created yet"
            hint="Choose a date range and a limit for all spending in that period."
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
                    label={b.name}
                    detail={`${money(spent, b.currency)} spent out of ${money(limit, b.currency)} budgeted.`}
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
