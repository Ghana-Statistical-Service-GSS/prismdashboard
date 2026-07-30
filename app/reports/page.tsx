/* eslint-disable @next/next/no-img-element -- quote photos use short-lived MinIO presigned URLs. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SearchableSelect } from "@/components/common/SearchableSelect";

type FilterOption = {
  id: string;
  name: string;
  region_id?: string | null;
  district_id?: string | null;
  market_id?: string | null;
};

type Report = {
  scope: {
    level: "NATIONAL" | "REGION" | "MARKETS";
    role: string;
    region_id: string | null;
    region_name: string | null;
    market_ids: string[] | null;
  };
  summary: {
    prices_submitted: number;
    items_priced: number;
    products_priced: number;
    product_linked_quotes: number;
    weighted_quotes: number;
    standardized_uom_quotes: number;
    local_uom_quotes: number;
    average_price: number | null;
    average_weight: number | null;
    minimum_price: number | null;
    maximum_price: number | null;
    last_submission_at: string | null;
    active_items: number;
    active_products: number;
    total_markets: number;
    markets_reporting: number;
    active_readers: number;
    readers_reporting: number;
  };
  filters: {
    regions: FilterOption[];
    districts: FilterOption[];
    markets: FilterOption[];
    users: FilterOption[];
    supervisors?: FilterOption[];
    uoms: FilterOption[];
  };
};

const integer = new Intl.NumberFormat("en-GH");
const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 2 });

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function date(value: string | null | undefined) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/reports/initiation", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || "Unable to load initiation report");
        return data;
      })
      .then((data) => { if (active) setReport(data); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Initiation</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Monitoring Reports</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">
                Monitor the initial product prices, weights and coverage collected before routine market pricing begins.
              </p>
            </div>
            <div className="inline-flex w-fit rounded-full border border-prism-border bg-white p-1.5 shadow-sm">
              <span className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white">Market Initiation</span>
              <span className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-prism-muted opacity-60">Market Reading · Soon</span>
            </div>
          </header>

          {loading && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted shadow-sm">Analysing live initiation submissions…</div>}
          {error && <div role="alert" className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

          {report && <ReportContent report={report} />}
        </main>
      </div>
    </div>
  );
}

function ReportContent({ report }: { report: Report }) {
  const s = report.summary;
  const isRegional = report.scope.level === "REGION";
  const isSupervisor = report.scope.level === "MARKETS";
  const quality = [
    { label: "Markets reporting", value: s.markets_reporting, total: s.total_markets, note: "Markets with at least one initial price." },
    { label: "Readers reporting", value: s.readers_reporting, total: s.active_readers, note: "Active readers who have submitted prices." },
    { label: "Item coverage", value: s.items_priced, total: s.active_items, note: "Active catalogue items with at least one initial price in this scope." },
  ];

  return (
    <>
      {isRegional && <div className="mt-8 rounded-2xl border border-prism-teal/30 bg-prism-teal/10 px-5 py-4 text-sm font-bold text-teal-900">Regional view · {report.scope.region_name || "Assigned region"} · Activity, records and filters are restricted to this region; item and product coverage is measured against the shared active PRISM catalogue.</div>}
      {isSupervisor && <div className="mt-8 rounded-2xl border border-prism-teal/30 bg-prism-teal/10 px-5 py-4 text-sm font-bold text-teal-900">Supervisor view · Activity, records and filters are restricted to your assigned markets; item and product coverage is measured against the shared active PRISM catalogue.</div>}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Prices submitted" value={integer.format(s.prices_submitted)} detail={`Latest ${date(s.last_submission_at)}`} color="teal" />
        <SummaryCard label="Products priced" value={`${integer.format(s.products_priced)} / ${integer.format(s.active_products)}`} detail={`${pct(s.products_priced, s.active_products)}% of active catalogue`} color="purple" />
        <SummaryCard label="Markets reporting" value={`${s.markets_reporting} / ${s.total_markets}`} detail={`${s.total_markets - s.markets_reporting} markets need attention`} color="pink" />
        <SummaryCard label="Readers reporting" value={`${s.readers_reporting} / ${s.active_readers}`} detail={`${s.active_readers - s.readers_reporting} readers have no prices`} color="orange" />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quality.map((item) => <QualityCard key={item.label} {...item} />)}
      </section>

      <section className="mt-8 rounded-3xl border border-prism-border/70 bg-white shadow-sm">
        <SubmissionTable filters={report.filters} scope={report.scope} />
      </section>

      <OutletCoverage filters={report.filters} scope={report.scope} />
      <ItemGapsTable filters={report.filters} scope={report.scope} />

    </>
  );
}

function SummaryCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: "teal" | "purple" | "pink" | "orange" }) {
  const styles = { teal: "bg-prism-teal", purple: "bg-prism-purple", pink: "bg-prism-pink", orange: "bg-amber-500" };
  return <article className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1.5 ${styles[color]}`} /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-prism-muted">{label}</p><p className="mt-3 text-3xl font-black tracking-tight text-prism-text">{value}</p><p className="mt-1 text-xs text-prism-muted">{detail}</p></article>;
}

function QualityCard({ label, value, total, note }: { label: string; value: number; total: number; note: string }) {
  const percent = pct(value, total);
  const color = percent >= 90 ? "bg-prism-teal" : percent >= 60 ? "bg-amber-400" : "bg-prism-pink";
  return <article className="rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black text-prism-text">{label}</p><span className="text-lg font-black text-prism-purple">{percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-prism-bg"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs text-prism-muted"><strong className="text-prism-text">{integer.format(value)} of {integer.format(total)}</strong> · {note}</p></article>;
}

type ApprovalStatus = "APPROVED" | "PENDING" | "REJECTED";

type Submission = {
  id: string;
  item_code: string;
  item_name: string;
  product_name: string;
  notes?: string | null;
  product_description: string | null;
  item_description?: string | null;
  price: number;
  weight: number | null;
  uom_local: string | null;
  uom_standard: string | null;
  uom_type: "LOCAL" | "STANDARDIZED" | null;
  region_name: string;
  district_name: string;
  market_name: string;
  outlet_name: string;
  reader_name: string;
  supervisor_approval: ApprovalStatus;
  supervisor_approved_at: string | null;
  supervisor_approved_by_name: string | null;
  supervisor_approval_comment: string | null;
  rs_approval: ApprovalStatus;
  rs_approved_at: string | null;
  rs_approved_by_name: string | null;
  rs_approval_comment: string | null;
  hq_approval: ApprovalStatus;
  hq_approved_at: string | null;
  hq_approved_by_name: string | null;
  hq_approval_comment: string | null;
  photo_count: number;
  created_at: string;
  loaded_at?: string;
};

const SUBMISSION_COLUMN_OPTIONS = [
  { id: "serial", label: "S/N" },
  { id: "item", label: "Item" },
  { id: "product", label: "Product" },
  { id: "description", label: "Product description" },
  { id: "photo", label: "Photo" },
  { id: "price", label: "Price" },
  { id: "weight", label: "Weight" },
  { id: "localUom", label: "Local UOM" },
  { id: "standardUom", label: "Standardized UOM" },
  { id: "uomType", label: "UOM type" },
  { id: "location", label: "Region / District / Market" },
  { id: "outlet", label: "Outlet" },
  { id: "reader", label: "Market reader" },
  { id: "supervisorApproval", label: "Supervisor approval" },
  { id: "rsApproval", label: "RS approval" },
  { id: "hqApproval", label: "HQ approval" },
  { id: "loaded", label: "Loaded" },
] as const;

type SubmissionColumnId = (typeof SUBMISSION_COLUMN_OPTIONS)[number]["id"];

const ALL_SUBMISSION_COLUMNS = SUBMISSION_COLUMN_OPTIONS.map((column) => column.id);
const COMPACT_SUBMISSION_COLUMNS: SubmissionColumnId[] = ["item", "product", "description", "photo", "price", "weight", "standardUom"];
const SUBMISSION_COLUMNS_STORAGE_KEY = "prism-reports-products-prices-columns";

type SubmissionPhoto = {
  id: string;
  image_url: string | null;
  captured_at: string | null;
  created_at: string;
  notes: string | null;
};

type ExportJob = {
  id: string;
  format: "CSV";
  filters: Record<string, string | string[] | null>;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  progress_rows: number;
  total_rows: number | null;
  file_name: string | null;
  file_size: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
};

type ExportSelection = {
  regionId: string;
  districtId: string;
  marketId: string;
  supervisorId: string;
  readerId: string;
  dateField: "LOADED" | "CAPTURED";
  dateFrom: string;
  dateTo: string;
  approvalStage: "SUPERVISOR" | "RS" | "HQ";
  approvalStatus: "" | ApprovalStatus;
};

const APPROVAL_OPTIONS = [
  { id: "APPROVED", name: "Approved" },
  { id: "PENDING", name: "Pending" },
  { id: "REJECTED", name: "Rejected" },
];

function ApprovalBadge({ status, byName, at, comment }: { status: ApprovalStatus; byName: string | null; at: string | null; comment?: string | null }) {
  const config = {
    APPROVED: ["Approved", "bg-green-50 text-green-700"],
    REJECTED: ["Rejected", "bg-red-50 text-red-700"],
    PENDING: ["Pending", "bg-yellow-50 text-yellow-700"],
  }[status] ?? ["Pending", "bg-yellow-50 text-yellow-700"];
  return (
    <div className="max-w-44">
      <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold uppercase ${config[1]}`}>{config[0]}</span>
      {byName && status !== "PENDING" && <p className="mt-1 whitespace-nowrap text-[9px] text-prism-muted">{byName}</p>}
      {at && status !== "PENDING" && <p className="mt-0.5 whitespace-nowrap text-[9px] text-prism-muted">{date(at)}</p>}
      {comment && status !== "PENDING" && <p className="mt-1 text-[9px] italic leading-4 text-prism-muted">“{comment}”</p>}
    </div>
  );
}

function DecisionCommentModal({ decision, count, comment, onComment, onConfirm, onCancel, busy }: {
  decision: "APPROVED" | "REJECTED";
  count: number;
  comment: string;
  onComment: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const approving = decision === "APPROVED";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onCancel}>
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-base font-black text-prism-text">{approving ? "Approve" : "Reject"} {integer.format(count)} quote{count === 1 ? "" : "s"}</h3>
        <p className="mt-1 text-xs text-prism-muted">Add an optional comment — it will be shown with the {approving ? "approval" : "rejection"}.</p>
        <textarea value={comment} onChange={(event) => onComment(event.target.value)} rows={3} maxLength={500} placeholder="Optional comment…" className="mt-4 w-full rounded-xl border border-prism-border p-3 text-xs outline-none focus:border-prism-purple" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="rounded-full border border-prism-border bg-white px-4 py-2 text-xs font-bold text-prism-text disabled:opacity-40">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className={`rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-40 ${approving ? "bg-green-600" : "bg-red-600"}`}>{busy ? "Saving…" : approving ? "Approve" : "Reject"}</button>
        </div>
      </section>
    </div>
  );
}

function QuotePhotoModal({ submission, onClose }: { submission: Submission; onClose: () => void }) {
  const [photos, setPhotos] = useState<SubmissionPhoto[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard/photos?quoteId=${encodeURIComponent(submission.id)}&page=1&pageSize=12&includeFilters=false`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message || "Unable to load product photos"); return body; })
      .then((body) => setPhotos(body.rows || []))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [submission.id]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  const photo = photos[active];
  return <div role="dialog" aria-modal="true" aria-label={`${submission.product_name} photos`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"><section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-prism-border px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-prism-teal">Product photo</p><h3 className="mt-1 text-xl font-black text-prism-text">{submission.item_name} · {submission.product_name}</h3><p className="mt-1 text-xs text-prism-muted">{submission.outlet_name} · {submission.market_name} · {money.format(Number(submission.price))}</p></div><button onClick={onClose} aria-label="Close product photo" className="rounded-full bg-prism-bg px-4 py-2 text-lg font-bold text-prism-purple">×</button></header>
    {loading ? <p className="p-12 text-center text-sm text-prism-muted">Loading product photo…</p> : error ? <p className="m-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : !photos.length ? <p className="p-12 text-center text-sm text-prism-muted">No photo was submitted for this product and price.</p> : <div className="grid lg:grid-cols-[1fr_18rem]"><div className="flex min-h-80 items-center justify-center bg-slate-950">{photo?.image_url && !failed ? <img src={photo.image_url} alt={`${submission.item_name} — ${submission.product_name}`} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-[72vh] w-full object-contain" /> : <p className="p-12 text-center text-sm text-white/70">Photo unavailable from storage</p>}</div><aside className="p-5"><p className="text-xs font-bold text-prism-text">{photos.length} photo{photos.length === 1 ? "" : "s"}</p>{photos.length > 1 && <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((item, index) => <button key={item.id} onClick={() => { setActive(index); setFailed(false); }} className={`aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 ${index === active ? "border-prism-purple" : "border-transparent"}`}>{item.image_url && <img src={item.image_url} alt={`Photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />}</button>)}</div>}<dl className="mt-5 space-y-3 text-xs"><div><dt className="font-bold uppercase tracking-wider text-prism-muted">Weight</dt><dd className="mt-1 font-semibold text-prism-text">{submission.weight == null ? "—" : integer.format(Number(submission.weight))} {submission.uom_standard || submission.uom_local || ""}</dd></div><div><dt className="font-bold uppercase tracking-wider text-prism-muted">Market reader</dt><dd className="mt-1 font-semibold text-prism-text">{submission.reader_name}</dd></div>{photo?.notes && <div><dt className="font-bold uppercase tracking-wider text-prism-muted">Description</dt><dd className="mt-1 leading-5 text-prism-text">{photo.notes}</dd></div>}</dl></aside></div>}
  </section></div>;
}

function ExportSelectionModal({
  filters,
  scope,
  initial,
  jobs,
  busy,
  downloadingId,
  error,
  onCreate,
  onDownload,
  onClose,
}: {
  filters: Report["filters"];
  scope: Report["scope"];
  initial: ExportSelection;
  jobs: ExportJob[];
  busy: boolean;
  downloadingId: string;
  error: string;
  onCreate: (selection: ExportSelection) => Promise<void>;
  onDownload: (job: ExportJob) => Promise<void>;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState(initial);
  const districts = useMemo(() => filters.districts.filter((row) => !selection.regionId || row.region_id === selection.regionId), [filters.districts, selection.regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!selection.regionId || row.region_id === selection.regionId) && (!selection.districtId || row.district_id === selection.districtId)), [filters.markets, selection.regionId, selection.districtId]);
  const readers = useMemo(() => filters.users.filter((row) => (!selection.regionId || row.region_id === selection.regionId) && (!selection.districtId || row.district_id === selection.districtId) && (!selection.marketId || row.market_id === selection.marketId)), [filters.users, selection.regionId, selection.districtId, selection.marketId]);
  const supervisors = useMemo(() => (filters.supervisors || []).filter((row) => !selection.regionId || row.region_id === selection.regionId), [filters.supervisors, selection.regionId]);
  const activeJob = jobs.find((job) => job.status === "PENDING" || job.status === "PROCESSING");

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  const update = <K extends keyof ExportSelection>(key: K, value: ExportSelection[K]) => {
    setSelection((current) => ({ ...current, [key]: value }));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Prepare products and prices download" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-prism-border px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-prism-teal">Background export</p>
            <h3 className="mt-1 text-xl font-black text-prism-text">Select data to download</h3>
            <p className="mt-1 text-xs leading-5 text-prism-muted">The CSV is generated outside the API process, opens in Excel, and remains available for 24 hours.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close export selection" className="rounded-full bg-prism-bg px-4 py-2 text-lg font-bold text-prism-purple">×</button>
        </header>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FilterSelect label="Region" value={selection.regionId} onChange={(value) => setSelection((current) => ({ ...current, regionId: value, districtId: "", marketId: "", supervisorId: "", readerId: "" }))} options={filters.regions} disabled={scope.level === "REGION"} />
            <FilterSelect label="District" value={selection.districtId} onChange={(value) => setSelection((current) => ({ ...current, districtId: value, marketId: "", readerId: "" }))} options={districts} />
            <FilterSelect label="Market" value={selection.marketId} onChange={(value) => setSelection((current) => ({ ...current, marketId: value, readerId: "" }))} options={markets} />
            <FilterSelect label="Supervisor" value={selection.supervisorId} onChange={(value) => update("supervisorId", value)} options={supervisors} />
            <FilterSelect label="Market reader" value={selection.readerId} onChange={(value) => update("readerId", value)} options={readers} />
            <FilterSelect label="Date type" value={selection.dateField} onChange={(value) => update("dateField", value as ExportSelection["dateField"])} options={[{ id: "LOADED", name: "Loaded / synced date" }, { id: "CAPTURED", name: "Captured date" }]} />
            <label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">From day</span>
              <input type="date" value={selection.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">To day</span>
              <input type="date" value={selection.dateTo} min={selection.dateFrom || undefined} onChange={(event) => update("dateTo", event.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
            </label>
            <FilterSelect label="Approval level" value={selection.approvalStage} onChange={(value) => update("approvalStage", value as ExportSelection["approvalStage"])} options={[{ id: "SUPERVISOR", name: "Supervisor" }, { id: "RS", name: "Regional Statistician" }, { id: "HQ", name: "HQ" }]} disabled={scope.role === "SUPERVISOR" || scope.role === "REGIONAL_STATISTICIAN"} />
            <FilterSelect label="Approval status" value={selection.approvalStatus} onChange={(value) => update("approvalStatus", value as ExportSelection["approvalStatus"])} options={APPROVAL_OPTIONS} />
          </div>

          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          {activeJob && (
            <div className="mt-5 rounded-2xl border border-prism-teal/30 bg-teal-50 p-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <strong className="text-teal-900">Download in progress</strong>
                <span className="text-teal-800">{activeJob.total_rows ? `${Math.min(100, Math.round((activeJob.progress_rows / activeJob.total_rows) * 100))}%` : "Preparing…"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-prism-teal transition-all" style={{ width: `${activeJob.total_rows ? Math.min(100, Math.round((activeJob.progress_rows / activeJob.total_rows) * 100)) : 8}%` }} /></div>
              <p className="mt-2 text-[10px] text-teal-800">{integer.format(activeJob.progress_rows)}{activeJob.total_rows ? ` of ${integer.format(activeJob.total_rows)}` : ""} rows prepared</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-prism-border px-5 py-2.5 text-xs font-bold text-prism-text">Close</button>
            <button type="button" disabled={busy || Boolean(activeJob)} onClick={() => onCreate(selection)} className="rounded-full bg-prism-teal px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Queuing…" : activeJob ? "Download in progress" : "Prepare CSV download"}</button>
          </div>

          <div className="mt-7 border-t border-prism-border pt-5">
            <h4 className="text-xs font-black uppercase tracking-[0.14em] text-prism-muted">Recent downloads</h4>
            <div className="mt-3 space-y-2">
              {!jobs.length && <p className="rounded-xl bg-prism-bg p-4 text-xs text-prism-muted">No export jobs yet.</p>}
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex flex-col gap-2 rounded-xl border border-prism-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-prism-text">{job.file_name || "Products and Prices export"}</p>
                    <p className="mt-1 text-[10px] text-prism-muted">{date(job.created_at)} · {job.status.toLowerCase()}</p>
                    {job.error_message && <p className="mt-1 text-[10px] text-red-700">{job.error_message}</p>}
                  </div>
                  {job.status === "COMPLETED" && <button type="button" disabled={downloadingId === job.id} onClick={() => onDownload(job)} className="rounded-full bg-prism-purple px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">{downloadingId === job.id ? "Opening…" : "Download"}</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SubmissionTable({ filters, scope }: { filters: Report["filters"]; scope: Report["scope"] }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [regionId, setRegionId] = useState(scope.level === "REGION" ? scope.region_id || "" : "");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [userId, setUserId] = useState("");
  const [uom, setUom] = useState("");
  const [uomType, setUomType] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [creatingExport, setCreatingExport] = useState(false);
  const [downloadingExportId, setDownloadingExportId] = useState("");
  const role = scope.role;
  const [supervisorApproval, setSupervisorApproval] = useState("");
  const [rsApproval, setRsApproval] = useState("");
  const [hqApproval, setHqApproval] = useState("");
  const [approvalGroup, setApprovalGroup] = useState<"" | "APPROVED" | "UNAPPROVED">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDecision, setPendingDecision] = useState<{ decision: "APPROVED" | "REJECTED"; quoteIds?: string[]; all?: boolean; count: number } | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [photoSubmission, setPhotoSubmission] = useState<Submission | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<SubmissionColumnId[]>(ALL_SUBMISSION_COLUMNS);
  const [columnPreferencesReady, setColumnPreferencesReady] = useState(false);
  const [showColumnChooser, setShowColumnChooser] = useState(false);

  const isHq = role === "HQ" || role === "ADMIN";
  const isRs = role === "REGIONAL_STATISTICIAN";
  const isSupervisor = role === "SUPERVISOR";
  const canSelect = isHq || isRs;
  // Every approving role also gets per-row buttons as an alternative to the bulk bar.
  const canApprove = isSupervisor || canSelect;
  // RS approves a page at a time: their page is pinned to 10 rows.
  const effectivePageSize = isRs ? 10 : pageSize;
  const isColumnVisible = (column: SubmissionColumnId) => visibleColumns.includes(column);
  const visibleColumnCount = visibleColumns.length + (canSelect ? 1 : 0) + (canApprove ? 1 : 0);
  const activeExport = exportJobs.find((job) => job.status === "PENDING" || job.status === "PROCESSING");

  const loadExportJobs = useCallback(async () => {
    const response = await fetch("/api/dashboard/reports/initiation/exports?limit=10", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message || "Unable to load exports");
    setExportJobs(body.jobs || []);
  }, []);

  useEffect(() => {
    loadExportJobs().catch(() => {});
  }, [loadExportJobs]);

  useEffect(() => {
    if (!activeExport) return;
    const timer = window.setInterval(() => {
      loadExportJobs().catch((reason) => setExportError(reason instanceof Error ? reason.message : "Unable to refresh export"));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeExport, loadExportJobs]);

  useEffect(() => {
    const saved = window.localStorage.getItem(SUBMISSION_COLUMNS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((value): value is SubmissionColumnId => ALL_SUBMISSION_COLUMNS.includes(value));
          if (valid.length) setVisibleColumns(valid);
        }
      } catch {
        window.localStorage.removeItem(SUBMISSION_COLUMNS_STORAGE_KEY);
      }
    } else if (window.matchMedia("(max-width: 767px)").matches) {
      setVisibleColumns(COMPACT_SUBMISSION_COLUMNS);
    }
    setColumnPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!columnPreferencesReady) return;
    window.localStorage.setItem(SUBMISSION_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [columnPreferencesReady, visibleColumns]);

  const toggleColumn = (column: SubmissionColumnId) => {
    setVisibleColumns((current) => {
      if (!current.includes(column)) return [...current, column];
      if (current.length === 1) return current;
      return current.filter((value) => value !== column);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch((current) => {
        const next = search.trim();
        if (next !== current) setPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const districts = useMemo(() => filters.districts.filter((row) => !regionId || row.region_id === regionId), [filters.districts, regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId)), [filters.markets, regionId, districtId]);
  const users = useMemo(() => filters.users.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId) && (!marketId || row.market_id === marketId)), [filters.users, regionId, districtId, marketId]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: String(effectivePageSize) });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (marketId) params.set("marketId", marketId);
    if (userId) params.set("userId", userId);
    if (uom) params.set("uom", uom);
    if (uomType) params.set("uomType", uomType);
    if (supervisorApproval) params.set("supervisorApproval", supervisorApproval);
    if (rsApproval) params.set("rsApproval", rsApproval);
    if (hqApproval) params.set("hqApproval", hqApproval);
    if (approvalGroup) params.set("approvalGroup", approvalGroup);
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/dashboard/reports/initiation/submissions?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || "Unable to load submissions");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError("");
        setRows((data.rows || []).map((row: Submission) => ({
          ...row,
          product_description: row.product_description ?? row.notes ?? row.item_description ?? null,
        })));
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
        setSelected([]);
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, effectivePageSize, regionId, districtId, marketId, userId, uom, uomType, supervisorApproval, rsApproval, hqApproval, approvalGroup, appliedSearch, refreshKey]);

  const resetPage = () => setPage(1);

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      if (isRs && previous.length >= 10) return previous;
      return [...previous, id];
    });
  };

  const togglePage = () => {
    setSelected((previous) => previous.length === rows.length && rows.length > 0 ? [] : rows.map((row) => row.id));
  };

  const act = async ({ decision, quoteIds, all = false, comment = "" }: { decision: ApprovalStatus; quoteIds?: string[]; all?: boolean; comment?: string }) => {
    setActing(true);
    setActionError("");
    setActionNotice("");
    try {
      const body: Record<string, unknown> = { decision };
      if (!all) body.quoteIds = quoteIds ?? selected;
      if (comment.trim()) body.comment = comment.trim();
      if (isHq && all) {
        body.all = true;
        body.filters = { regionId, districtId, marketId, userId, uom, uomType, search: appliedSearch, supervisorApproval, rsApproval, hqApproval, approvalGroup };
      }
      const response = await fetch("/api/dashboard/reports/initiation/submissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || "Approval failed");
      const skippedNote = data.skipped ? ` · ${data.skipped} outside your scope skipped` : "";
      setActionNotice(`${integer.format(data.updated)} quote${data.updated === 1 ? "" : "s"} set to ${decision.toLowerCase()}${skippedNote}`);
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Approval failed");
    } finally {
      setActing(false);
    }
  };

  const createExport = async (selection: ExportSelection) => {
    setCreatingExport(true);
    setExportError("");
    try {
      const response = await fetch("/api/dashboard/reports/initiation/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to start export");
      setExportJobs((current) => [body.job, ...current.filter((job) => job.id !== body.job.id)]);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Unable to start export");
    } finally {
      setCreatingExport(false);
    }
  };

  const downloadExport = async (job: ExportJob) => {
    setDownloadingExportId(job.id);
    setExportError("");
    try {
      const response = await fetch(`/api/dashboard/reports/initiation/exports/${encodeURIComponent(job.id)}/download`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to download export");
      window.location.assign(body.url);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Unable to download export");
    } finally {
      setDownloadingExportId("");
    }
  };

  const initialExportSelection: ExportSelection = {
    regionId,
    districtId,
    marketId,
    supervisorId: "",
    readerId: userId,
    dateField: "LOADED",
    dateFrom: "",
    dateTo: "",
    approvalStage: isSupervisor ? "SUPERVISOR" : isRs ? "RS" : hqApproval ? "HQ" : rsApproval ? "RS" : supervisorApproval ? "SUPERVISOR" : "HQ",
    approvalStatus: (isSupervisor ? supervisorApproval : isRs ? rsApproval : hqApproval || rsApproval || supervisorApproval) as ExportSelection["approvalStatus"],
  };

  return (
    <div>
      <div className="border-b border-prism-border/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-black text-prism-text">Products and Prices</h2>
            <p className="text-xs text-prism-muted">Individual market-initiation submissions with captured price and weight.</p>
          </div>
          <div className="relative flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => setShowColumnChooser((value) => !value)} aria-expanded={showColumnChooser} className="rounded-full border border-prism-border bg-white px-4 py-2 text-xs font-bold text-prism-text">Columns ({visibleColumns.length}/{ALL_SUBMISSION_COLUMNS.length})</button>
            <button type="button" onClick={() => setExportModalOpen(true)} className="rounded-full bg-prism-teal px-4 py-2 text-xs font-bold text-white">
              {activeExport ? `Download in progress${activeExport.total_rows ? ` · ${Math.min(100, Math.round((activeExport.progress_rows / activeExport.total_rows) * 100))}%` : "…"}` : "Select download"}
            </button>
            {showColumnChooser && (
              <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl border border-prism-border bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-prism-text">Visible columns</p>
                  <button type="button" onClick={() => setShowColumnChooser(false)} className="text-xs font-bold text-prism-muted">Close</button>
                </div>
                <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {SUBMISSION_COLUMN_OPTIONS.map((column) => (
                    <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-prism-text hover:bg-prism-bg">
                      <input type="checkbox" checked={isColumnVisible(column.id)} onChange={() => toggleColumn(column.id)} />
                      {column.label}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 border-t border-prism-border pt-3">
                  <button type="button" onClick={() => setVisibleColumns(COMPACT_SUBMISSION_COLUMNS)} className="rounded-full border border-prism-border px-3 py-1.5 text-[10px] font-bold text-prism-text">Compact</button>
                  <button type="button" onClick={() => setVisibleColumns(ALL_SUBMISSION_COLUMNS)} className="rounded-full bg-prism-purple px-3 py-1.5 text-[10px] font-bold text-white">Show all</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {exportError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{exportError}</p>}
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Products and Prices approval status">
          {([{ id: "", label: "All submissions" }, { id: "UNAPPROVED", label: "Unapproved" }, { id: "APPROVED", label: "Approved" }] as const).map((tab) => <button key={tab.id || "all"} role="tab" aria-selected={approvalGroup === tab.id} onClick={() => { setApprovalGroup(tab.id); setSupervisorApproval(""); setRsApproval(""); setHqApproval(""); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${approvalGroup === tab.id ? "bg-prism-purple text-white" : "border border-prism-border bg-white text-prism-muted"}`}>{tab.label}</button>)}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <FilterSelect label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setUserId(""); resetPage(); }} options={filters.regions} disabled={isRs} />
          <FilterSelect label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setUserId(""); resetPage(); }} options={districts} />
          <FilterSelect label="Market" value={marketId} onChange={(value) => { setMarketId(value); setUserId(""); resetPage(); }} options={markets} />
          <FilterSelect label="Market reader" value={userId} onChange={(value) => { setUserId(value); resetPage(); }} options={users} />
          <FilterSelect label="UOM" value={uom} onChange={(value) => { setUom(value); resetPage(); }} options={filters.uoms} />
          <FilterSelect label="UOM type" value={uomType} onChange={(value) => { setUomType(value); resetPage(); }} options={[{ id: "LOCAL", name: "Local" }, { id: "STANDARDIZED", name: "Standardized" }]} />
          <FilterSelect label="Supervisor approval" value={supervisorApproval} onChange={(value) => { setSupervisorApproval(value); resetPage(); }} options={APPROVAL_OPTIONS} />
          <FilterSelect label="RS approval" value={rsApproval} onChange={(value) => { setRsApproval(value); resetPage(); }} options={APPROVAL_OPTIONS} />
          <FilterSelect label="HQ approval" value={hqApproval} onChange={(value) => { setHqApproval(value); resetPage(); }} options={APPROVAL_OPTIONS} />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item, product, outlet or reader…" className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
          </div>
        </div>
        {canSelect && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-prism-bg/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-prism-muted">{isHq ? "HQ approval · bulk" : "RS approval · max 10 per page"}</span>
            {isHq && (
              <label className="flex items-center gap-1.5 text-xs text-prism-text">
                <input type="checkbox" checked={applyAll} onChange={(event) => setApplyAll(event.target.checked)} />
                Apply to all {integer.format(total)} matching
              </label>
            )}
            <span className="text-xs text-prism-muted">{selected.length} selected</span>
            <button disabled={acting || (!applyAll && !selected.length)} onClick={() => setPendingDecision({ decision: "APPROVED", quoteIds: selected, all: isHq && applyAll, count: isHq && applyAll ? total : selected.length })} className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">Approve</button>
            <button disabled={acting || (!applyAll && !selected.length)} onClick={() => setPendingDecision({ decision: "REJECTED", quoteIds: selected, all: isHq && applyAll, count: isHq && applyAll ? total : selected.length })} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">Reject</button>
            <button disabled={acting || (!applyAll && !selected.length)} onClick={() => act({ decision: "PENDING", all: isHq && applyAll })} className="rounded-full border border-prism-border bg-white px-4 py-1.5 text-xs font-bold text-prism-text disabled:opacity-40">Reset to pending</button>
          </div>
        )}
        {actionError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{actionError}</p>}
        {actionNotice && <p className="mt-3 rounded-xl bg-teal-50 p-3 text-xs text-teal-700">{actionNotice}</p>}
      </div>

      {error && <p className="m-5 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white text-[10px] uppercase tracking-[0.14em] text-prism-muted">
            <tr>
              {canSelect && <th className="px-2 py-2"><input type="checkbox" aria-label="Select page" checked={rows.length > 0 && selected.length === rows.length} onChange={togglePage} /></th>}
              {isColumnVisible("serial") && <th className="px-2.5 py-2 text-right">S/N</th>}
              {isColumnVisible("item") && <th className="px-2.5 py-2">Item</th>}
              {isColumnVisible("product") && <th className="px-2.5 py-2">Product</th>}
              {isColumnVisible("description") && <th className="px-2.5 py-2">Product description</th>}
              {isColumnVisible("photo") && <th className="px-2.5 py-2">Photo</th>}
              {isColumnVisible("price") && <th className="px-2.5 py-2 text-right">Price</th>}
              {isColumnVisible("weight") && <th className="px-2.5 py-2 text-right">Weight</th>}
              {isColumnVisible("localUom") && <th className="px-2.5 py-2">Local UOM</th>}
              {isColumnVisible("standardUom") && <th className="px-2.5 py-2">Standardized UOM</th>}
              {isColumnVisible("uomType") && <th className="px-2.5 py-2">Type</th>}
              {isColumnVisible("location") && <th className="px-2.5 py-2">Region / District / Market</th>}
              {isColumnVisible("outlet") && <th className="px-2.5 py-2">Outlet</th>}
              {isColumnVisible("reader") && <th className="px-2.5 py-2">Market reader</th>}
              {isColumnVisible("supervisorApproval") && <th className="px-2.5 py-2">Supervisor approval</th>}
              {isColumnVisible("rsApproval") && <th className="px-2.5 py-2">RS approval</th>}
              {isColumnVisible("hqApproval") && <th className="px-2.5 py-2">HQ approval</th>}
              {isColumnVisible("loaded") && <th className="px-2.5 py-2">Loaded</th>}
              {canApprove && <th className="px-2.5 py-2">Approve</th>}
            </tr>
          </thead>
          <tbody className={loading ? "opacity-50" : ""}>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50">
                {canSelect && <td className="px-2 py-2.5"><input type="checkbox" aria-label={`Select ${row.item_name}`} checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} /></td>}
                {isColumnVisible("serial") && <td className="px-2.5 py-2.5 text-right font-bold text-prism-muted">{(page - 1) * effectivePageSize + index + 1}</td>}
                {isColumnVisible("item") && <td className="px-2.5 py-2.5"><p className="font-bold text-prism-text">{row.item_name}</p><p className="text-[10px] text-prism-muted">{row.item_code}</p></td>}
                {isColumnVisible("product") && <td className="px-2.5 py-2.5 font-semibold text-prism-text">{row.product_name}</td>}
                {isColumnVisible("description") && <td className="max-w-72 px-2.5 py-2.5 text-prism-muted"><p className="line-clamp-3 leading-5" title={row.product_description || undefined}>{row.product_description || "—"}</p></td>}
                {isColumnVisible("photo") && <td className="px-2.5 py-2.5">{row.photo_count > 0 ? <button onClick={() => setPhotoSubmission(row)} className="whitespace-nowrap rounded-full border border-prism-teal/40 bg-teal-50 px-3 py-1.5 text-[10px] font-bold text-teal-800">View image{row.photo_count > 1 ? ` (${row.photo_count})` : ""}</button> : <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">No picture</span>}</td>}
                {isColumnVisible("price") && <td className="px-2.5 py-2.5 text-right text-sm font-black text-prism-purple">{money.format(Number(row.price))}</td>}
                {isColumnVisible("weight") && <td className="px-2.5 py-2.5 text-right font-bold text-prism-text">{row.weight == null ? "—" : integer.format(Number(row.weight))}</td>}
                {isColumnVisible("localUom") && <td className="px-2.5 py-2.5 text-prism-muted">{row.uom_local || "—"}</td>}
                {isColumnVisible("standardUom") && <td className="px-2.5 py-2.5 text-prism-muted">{row.uom_standard || "—"}</td>}
                {isColumnVisible("uomType") && <td className="px-2.5 py-2.5"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.uom_type === "LOCAL" ? "bg-amber-50 text-amber-700" : row.uom_type === "STANDARDIZED" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{row.uom_type || "—"}</span></td>}
                {isColumnVisible("location") && <td className="px-2.5 py-2.5 text-prism-muted"><p>{row.region_name}</p><p className="text-[10px]">{row.district_name} · {row.market_name}</p></td>}
                {isColumnVisible("outlet") && <td className="px-2.5 py-2.5 text-prism-muted">{row.outlet_name}</td>}
                {isColumnVisible("reader") && <td className="px-2.5 py-2.5 font-semibold text-prism-text">{row.reader_name}</td>}
                {isColumnVisible("supervisorApproval") && <td className="px-2.5 py-2.5"><ApprovalBadge status={row.supervisor_approval} byName={row.supervisor_approved_by_name} at={row.supervisor_approved_at} comment={row.supervisor_approval_comment} /></td>}
                {isColumnVisible("rsApproval") && <td className="px-2.5 py-2.5"><ApprovalBadge status={row.rs_approval} byName={row.rs_approved_by_name} at={row.rs_approved_at} comment={row.rs_approval_comment} /></td>}
                {isColumnVisible("hqApproval") && <td className="px-2.5 py-2.5"><ApprovalBadge status={row.hq_approval} byName={row.hq_approved_by_name} at={row.hq_approved_at} comment={row.hq_approval_comment} /></td>}
                {isColumnVisible("loaded") && <td className="whitespace-nowrap px-2.5 py-2.5 text-prism-muted"><p>{date(row.loaded_at || row.created_at)}</p>{row.loaded_at && row.loaded_at !== row.created_at && <p className="mt-1 text-[9px]">Captured {date(row.created_at)}</p>}</td>}
                {canApprove && <td className="whitespace-nowrap px-2.5 py-2.5"><div className="flex gap-1.5"><button disabled={acting} onClick={() => setPendingDecision({ decision: "APPROVED", quoteIds: [row.id], count: 1 })} className="rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40">Approve</button><button disabled={acting} onClick={() => setPendingDecision({ decision: "REJECTED", quoteIds: [row.id], count: 1 })} className="rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40">Reject</button></div></td>}
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan={visibleColumnCount} className="px-2.5 py-12 text-center text-prism-muted">No submissions match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-prism-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-prism-muted">{integer.format(total)} submissions · Page {page} of {totalPages}</p>
        <div className="flex items-center gap-2">{isRs ? <span className="rounded-xl border border-prism-border px-3 py-2 text-xs text-prism-muted">10 rows per page</span> : <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-xl border border-prism-border px-3 py-2 text-xs"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option></select>}<button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button></div>
      </div>
      {pendingDecision && (
        <DecisionCommentModal
          decision={pendingDecision.decision}
          count={pendingDecision.count}
          comment={decisionComment}
          onComment={setDecisionComment}
          busy={acting}
          onCancel={() => { setPendingDecision(null); setDecisionComment(""); }}
          onConfirm={async () => {
            await act({ decision: pendingDecision.decision, quoteIds: pendingDecision.quoteIds, all: pendingDecision.all, comment: decisionComment });
            setPendingDecision(null);
            setDecisionComment("");
          }}
        />
      )}
      {photoSubmission && <QuotePhotoModal submission={photoSubmission} onClose={() => setPhotoSubmission(null)} />}
      {exportModalOpen && (
        <ExportSelectionModal
          filters={filters}
          scope={scope}
          initial={initialExportSelection}
          jobs={exportJobs}
          busy={creatingExport}
          downloadingId={downloadingExportId}
          error={exportError}
          onCreate={createExport}
          onDownload={downloadExport}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: FilterOption[]; disabled?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">{label}</span>
      <div className="mt-1">
        <SearchableSelect value={value} onChange={onChange} placeholder={`All ${label.toLowerCase()}s`} options={options.map((option) => ({ value: option.id, label: option.name }))} disabled={disabled} />
      </div>
    </div>
  );
}

function TablePager({ page, pages, total, unit, onPage }: { page: number; pages: number; total: number; unit: string; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-prism-border/70 p-5">
      <p className="text-xs text-prism-muted">{integer.format(total)} {unit} · Page {page} of {pages}</p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

type OutletRow = {
  id: string;
  outlet_code: string | null;
  outlet_name: string;
  outlet_type: string | null;
  is_active: boolean;
  created_at: string;
  market_id: string;
  market_name: string;
  district_id: string;
  district_name: string;
  region_id: string;
  region_name: string;
  created_by: string | null;
  created_by_name: string | null;
  prices_submitted: number;
  items_priced: number;
  products_priced: number;
  last_submission_at: string | null;
};

function OutletCoverage({ filters, scope }: { filters: Report["filters"]; scope: Report["scope"] }) {
  const [rows, setRows] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"areas" | "outlets" | "interviewers">("areas");
  const [regionId, setRegionId] = useState(scope.level === "REGION" ? scope.region_id || "" : "");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/reports/initiation/outlets", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load outlet coverage");
        return body;
      })
      .then((body) => { if (active) setRows(body.rows); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const districts = useMemo(() => filters.districts.filter((row) => !regionId || row.region_id === regionId), [filters.districts, regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId)), [filters.markets, regionId, districtId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) =>
      (!regionId || row.region_id === regionId) &&
      (!districtId || row.district_id === districtId) &&
      (!marketId || row.market_id === marketId) &&
      (!needle || row.outlet_name.toLowerCase().includes(needle) || (row.created_by_name ?? "").toLowerCase().includes(needle) || row.market_name.toLowerCase().includes(needle)));
  }, [rows, regionId, districtId, marketId, search]);

  const areaSummary = useMemo(() => {
    const map = new Map<string, { name: string; outlets: number; districts: Set<string>; markets: Set<string>; interviewers: Set<string>; prices: number }>();
    for (const row of filtered) {
      const key = scope.level === "NATIONAL" ? row.region_id : scope.level === "REGION" ? `${row.district_id}:${row.market_id}` : row.market_id;
      const name = scope.level === "NATIONAL"
        ? row.region_name
        : scope.level === "REGION"
          ? `${row.district_name} · ${row.market_name}`
          : row.market_name;
      const entry = map.get(key) ?? { name, outlets: 0, districts: new Set<string>(), markets: new Set<string>(), interviewers: new Set<string>(), prices: 0 };
      entry.outlets += 1;
      entry.districts.add(row.district_id);
      entry.markets.add(row.market_id);
      if (row.created_by) entry.interviewers.add(row.created_by);
      entry.prices += row.prices_submitted;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.outlets - a.outlets);
  }, [filtered, scope.level]);

  const interviewerSummary = useMemo(() => {
    const map = new Map<string, { name: string; outlets: number; regions: Set<string>; markets: Set<string>; latest: string }>();
    for (const row of filtered) {
      const key = row.created_by ?? "unknown";
      const entry = map.get(key) ?? { name: row.created_by_name ?? "Unknown interviewer", outlets: 0, regions: new Set<string>(), markets: new Set<string>(), latest: row.created_at };
      entry.outlets += 1;
      entry.regions.add(row.region_name);
      entry.markets.add(row.market_name);
      if (row.created_at > entry.latest) entry.latest = row.created_at;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.outlets - a.outlets);
  }, [filtered]);

  const pages = Math.max(Math.ceil(filtered.length / 10), 1);
  const visibleOutlets = filtered.slice((page - 1) * 10, page * 10);

  const tabs: { key: typeof view; label: string }[] = [
    { key: "areas", label: scope.level === "NATIONAL" ? "By region" : scope.level === "REGION" ? "By district / market" : "By market" },
    { key: "outlets", label: "By outlet" },
    { key: "interviewers", label: "By interviewer" },
  ];
  const areaLabel = scope.level === "NATIONAL" ? "Region" : scope.level === "REGION" ? "District / Market" : "Market";

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="border-b border-prism-border/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-base font-black text-prism-text">Outlet coverage</h2><p className="mt-1 text-xs text-prism-muted">Outlets created during initiation, with items and products priced per outlet and outlets per interviewer.</p></div>
          <div className="flex gap-2">{tabs.map((tab) => <button key={tab.key} onClick={() => { setView(tab.key); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${view === tab.key ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-purple"}`}>{tab.label}</button>)}</div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setPage(1); }} options={filters.regions} disabled={scope.level === "REGION"} />
          <FilterSelect label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setPage(1); }} options={districts} />
          <FilterSelect label="Market" value={marketId} onChange={(value) => { setMarketId(value); setPage(1); }} options={markets} />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">Search</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Outlet, market or interviewer…" className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
          </div>
        </div>
      </div>
      {error && <p className="m-5 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        {view === "areas" && (
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">{areaLabel}</th><th className="px-5 py-3 text-right">Outlets created</th><th className="px-5 py-3 text-right">Districts</th><th className="px-5 py-3 text-right">Markets</th><th className="px-5 py-3 text-right">Interviewers</th><th className="px-5 py-3 text-right">Prices submitted</th></tr></thead>
            <tbody className={loading ? "opacity-50" : ""}>{areaSummary.map((row, index) => <tr key={row.name} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{index + 1}</td><td className="px-5 py-4 font-bold text-prism-text">{row.name}</td><td className="px-5 py-4 text-right font-black text-prism-purple">{integer.format(row.outlets)}</td><td className="px-5 py-4 text-right">{row.districts.size}</td><td className="px-5 py-4 text-right">{row.markets.size}</td><td className="px-5 py-4 text-right">{row.interviewers.size}</td><td className="px-5 py-4 text-right">{integer.format(row.prices)}</td></tr>)}{!loading && !areaSummary.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-prism-muted">No outlets match the filters.</td></tr>}</tbody>
          </table>
        )}
        {view === "outlets" && (
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Outlet</th><th className="px-5 py-3">Region / District / Market</th><th className="px-5 py-3">Interviewer</th><th className="px-5 py-3 text-right">Items priced</th><th className="px-5 py-3 text-right">Products priced</th><th className="px-5 py-3 text-right">Prices</th><th className="px-5 py-3">Last submission</th></tr></thead>
            <tbody className={loading ? "opacity-50" : ""}>{visibleOutlets.map((row, index) => <tr key={row.id} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * 10 + index + 1}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.outlet_name}</p><p className="text-[10px] text-prism-muted">{row.outlet_code || "—"}{row.outlet_type ? ` · ${row.outlet_type}` : ""}</p></td><td className="px-5 py-4 text-prism-muted"><p>{row.region_name}</p><p className="text-[10px]">{row.district_name} · {row.market_name}</p></td><td className="px-5 py-4 font-semibold text-prism-text">{row.created_by_name || "—"}</td><td className="px-5 py-4 text-right font-black text-prism-purple">{integer.format(row.items_priced)}</td><td className="px-5 py-4 text-right font-black text-prism-teal">{integer.format(row.products_priced)}</td><td className="px-5 py-4 text-right">{integer.format(row.prices_submitted)}</td><td className="whitespace-nowrap px-5 py-4 text-prism-muted">{date(row.last_submission_at)}</td></tr>)}{!loading && !visibleOutlets.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-prism-muted">No outlets match the filters.</td></tr>}</tbody>
          </table>
        )}
        {view === "interviewers" && (
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Interviewer</th><th className="px-5 py-3 text-right">Outlets created</th><th className="px-5 py-3 text-right">Markets</th><th className="px-5 py-3">Regions</th><th className="px-5 py-3">Latest outlet created</th></tr></thead>
            <tbody className={loading ? "opacity-50" : ""}>{interviewerSummary.map((row, index) => <tr key={row.name} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{index + 1}</td><td className="px-5 py-4 font-bold text-prism-text">{row.name}</td><td className="px-5 py-4 text-right font-black text-prism-purple">{integer.format(row.outlets)}</td><td className="px-5 py-4 text-right">{row.markets.size}</td><td className="px-5 py-4 text-prism-muted">{[...row.regions].join(", ")}</td><td className="whitespace-nowrap px-5 py-4 text-prism-muted">{date(row.latest)}</td></tr>)}{!loading && !interviewerSummary.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-prism-muted">No outlets match the filters.</td></tr>}</tbody>
          </table>
        )}
      </div>
      {view === "outlets" && <TablePager page={page} pages={pages} total={filtered.length} unit="outlets" onPage={setPage} />}
    </section>
  );
}

type ItemGapRow = {
  item_id: string;
  item_code: string;
  item_name: string;
  expected_markets: number;
  markets_priced: number;
  markets_at_target: number;
  markets_with_gap: number;
  markets_never_priced: number;
  times_priced: number;
};

function ItemGapsTable({ filters, scope }: { filters: Report["filters"]; scope: Report["scope"] }) {
  const [rows, setRows] = useState<ItemGapRow[]>([]);
  const [summary, setSummary] = useState<{ never_priced_pairs: number; items_never_priced: number } | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [regionId, setRegionId] = useState(scope.level === "REGION" ? scope.region_id || "" : "");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isRegionalStatistician = scope.level === "REGION";
  const assignedRegionId = scope.region_id || "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch((current) => {
        const next = search.trim();
        if (next !== current) setPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const districts = useMemo(() => filters.districts.filter((row) => !regionId || row.region_id === regionId), [filters.districts, regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId)), [filters.markets, regionId, districtId]);
  const availableRegions = useMemo(() => isRegionalStatistician ? filters.regions.filter((row) => row.id === assignedRegionId) : filters.regions, [filters.regions, isRegionalStatistician, assignedRegionId]);
  const scopeLabel = marketId
    ? filters.markets.find((row) => row.id === marketId)?.name || "Selected market"
    : districtId
      ? filters.districts.find((row) => row.id === districtId)?.name || "Selected district"
      : regionId
        ? filters.regions.find((row) => row.id === regionId)?.name || "Selected region"
        : "National";

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (marketId) params.set("marketId", marketId);
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/dashboard/reports/initiation/item-gaps?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load item pricing gaps");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setError("");
        setRows(body.rows);
        setSummary(body.summary);
        setTotal(body.pagination.total);
        setPages(body.pagination.total_pages);
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, regionId, districtId, marketId, appliedSearch]);

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="border-b border-prism-border/70 p-5">
        <h2 className="text-base font-black text-prism-text">Item pricing gaps</h2>
        <p className="mt-1 text-xs text-prism-muted">Each item appears once for the selected scope. Completion requires quotations from six distinct outlets per market; total prices are shown separately.</p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-prism-purple">{scopeLabel} view</span>
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-700">{integer.format(summary.items_never_priced)} items never priced in scope</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">{integer.format(summary.never_priced_pairs)} item–market pairs with no price</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{integer.format(total)} items with a pricing gap</span>
          </div>
        )}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setPage(1); }} options={availableRegions} disabled={isRegionalStatistician} />
          <FilterSelect label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setPage(1); }} options={districts} />
          <FilterSelect label="Market" value={marketId} onChange={(value) => { setMarketId(value); setPage(1); }} options={markets} />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">Search item</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item name or code…" className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
          </div>
        </div>
      </div>
      {error && <p className="m-5 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Item</th><th className="px-5 py-3">Scope</th><th className="px-5 py-3 text-right">Markets priced</th><th className="px-5 py-3 text-right">Markets at 6 outlets</th><th className="px-5 py-3 text-right">Total prices</th><th className="px-5 py-3">Status</th></tr></thead>
          <tbody className={loading ? "opacity-50" : ""}>{rows.map((row, index) => <tr key={row.item_id} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * 10 + index + 1}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.item_name}</p><p className="text-[10px] text-prism-muted">{row.item_code}</p></td><td className="px-5 py-4 font-semibold text-prism-text">{scopeLabel}</td><td className="px-5 py-4 text-right"><span className="font-black text-prism-purple">{row.markets_priced}</span><span className="text-prism-muted"> / {row.expected_markets}</span></td><td className="px-5 py-4 text-right font-bold text-prism-text">{row.markets_at_target}</td><td className="px-5 py-4 text-right font-black text-prism-text">{row.times_priced}</td><td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold uppercase ${row.times_priced === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{row.times_priced === 0 ? "Never priced in scope" : `${row.markets_with_gap} markets below 6 outlets`}</span></td></tr>)}{!loading && !rows.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-prism-muted">No pricing gaps match the filters.</td></tr>}</tbody>
        </table>
      </div>
      <TablePager page={page} pages={pages} total={total} unit="items" onPage={setPage} />
    </section>
  );
}
