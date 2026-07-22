type Props = {
  page: number;
  pageSize: 10 | 20;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 20) => void;
};

export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = total ? (current - 1) * pageSize + 1 : 0;
  const end = Math.min(current * pageSize, total);
  return <div className="flex flex-col gap-3 border-t border-prism-border px-5 py-4 text-xs text-prism-muted sm:flex-row sm:items-center sm:justify-between"><p>{start}–{end} of {total} records</p><div className="flex items-center gap-2"><label className="flex items-center gap-2 font-semibold">Rows<select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value) as 10 | 20)} className="rounded-lg border border-prism-border bg-white px-2 py-1.5 text-prism-text"><option value={10}>10</option><option value={20}>20</option></select></label><button disabled={current <= 1} onClick={() => onPageChange(current - 1)} className="rounded-full border border-prism-border px-3 py-1.5 font-bold disabled:opacity-35">Previous</button><span className="min-w-16 text-center font-bold text-prism-text">{current} / {totalPages}</span><button disabled={current >= totalPages} onClick={() => onPageChange(current + 1)} className="rounded-full border border-prism-border px-3 py-1.5 font-bold disabled:opacity-35">Next</button></div></div>;
}
