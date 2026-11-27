import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "../styles/table-pagination.css";

const PAGE_SIZE = 10;
export function useTablePagination<T>(items: readonly T[], filterKey = "") {
  const [state, setState] = useState({ page: 1, filterKey });
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = state.filterKey === filterKey ? Math.min(state.page, pages) : 1;
  useEffect(() => {
    setState(s => s.filterKey === filterKey && s.page === page ? s : { page, filterKey });
  }, [page, filterKey]);
  const start = (page - 1) * PAGE_SIZE;
  return { rows: items.slice(start, start + PAGE_SIZE), page, pages, total,
    first: total ? start + 1 : 0, last: Math.min(start + PAGE_SIZE, total),
    previous: () => setState({ page: Math.max(1, page - 1), filterKey }),
    next: () => setState({ page: Math.min(pages, page + 1), filterKey }) };
}

type Controls = Omit<ReturnType<typeof useTablePagination<unknown>>, "rows">;
export function TablePagination({ page, pages, total, first, last, previous, next }: Controls) {
  if (!total) return null;
  return <nav className="table-pagination" aria-label="Table pagination">
    <span className="mute sm" role="status">{first}–{last} of {total} entries</span>
    <div className="table-pagination-controls">
      <button type="button" className="btn sm" onClick={previous} disabled={page === 1}><ChevronLeft size={15} aria-hidden="true"/>Previous</button>
      <span className="mute sm">Page {page} of {pages}</span>
      <button type="button" className="btn sm" onClick={next} disabled={page === pages}>Next<ChevronRight size={15} aria-hidden="true"/></button>
    </div>
  </nav>;
}
