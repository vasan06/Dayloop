import { useState, type FormEvent } from "react";
import { useCategories, useCreateTransaction } from "../hooks/data";
import { isoDate } from "../lib/format";
import { Modal } from "./ui";

export default function TransactionForm({ currency, onClose }: { currency: string; onClose: () => void }) {
  const [type, setType] = useState("expense");
  const categories = useCategories();
  const create = useCreateTransaction();
  const choices = (categories.data ?? []).filter((category) => category.category_type === type);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("category") ?? "").trim();
    const existing = choices.find((category) => category.name.toLowerCase() === name.toLowerCase());
    create.mutate({
      transaction_type: type,
      currency,
      amount: form.get("amount"),
      transaction_date: form.get("date"),
      description: form.get("description"),
      ...(existing ? { category_id: existing.id } : { category_name: name }),
    }, { onSuccess: onClose });
  }

  return <Modal title="Add transaction" onClose={onClose}>
    <form onSubmit={submit}>
      <div className="fr">
        <label className="field">Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="expense">Expense</option><option value="income">Income</option>
          </select>
        </label>
        <label className="field">Amount ({currency})
          <input name="amount" type="number" step="0.01" min="0.01" max="999999999999.99" required />
        </label>
      </div>
      <label className="field">Description<input name="description" maxLength={240} /></label>
      <div className="fr">
        <label className="field">Category
          <input name="category" key={type} list="transaction-categories" maxLength={80} placeholder="Choose or type a name" />
          <datalist id="transaction-categories">{choices.map((item) => <option key={item.id} value={item.name} />)}</datalist>
        </label>
        <label className="field">Date<input name="date" type="date" defaultValue={isoDate()} required /></label>
      </div>
      {create.error && <p role="alert" className="err">{create.error.message}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={create.isPending}>Save transaction</button>
      </div>
    </form>
  </Modal>;
}
