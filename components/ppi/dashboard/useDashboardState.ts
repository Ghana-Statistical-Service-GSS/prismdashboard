"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

// Dashboard state lives in the address: filters, the drill path and the
// view survive a refresh, can be shared, and the browser's Back button
// returns to the previous comparison. Drilling pushes a history entry;
// changing a control on the same view replaces it.
//
// Changes go through the History API, which Next keeps useSearchParams in
// step with: on this statically rendered page, router.push/replace did
// nothing in a production build once the page had been opened with a query
// string (a bookmark, a refresh or a shared link).
const PARAMS = {
  regionId: "region",
  districtId: "district",
  supervisorId: "supervisor",
  enumeratorId: "reader",
  questionnaireType: "qt",
  mode: "mode",
  view: "view",
  initiationId: "initiation",
  status: "status",
  search: "q",
  page: "page",
  metric: "metric",
  sort: "sort",
  from: "from",
  to: "to",
  kind: "kind",
  attentionPage: "apage",
} as const;

export type DashboardState = { -readonly [K in keyof typeof PARAMS]: string | null };
export type StatePatch = Partial<DashboardState>;

// The filters every request carries (the server ANDs them with the scope).
export const FILTER_KEYS = ["regionId", "districtId", "supervisorId", "enumeratorId", "questionnaireType", "mode"] as const;

export function apiQuery(state: DashboardState, extra: Record<string, string | null | undefined> = {}) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) if (state[key]) query.set(key, state[key] as string);
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  return query.toString();
}

export function navigate(target: string, { push = true }: { push?: boolean } = {}) {
  if (push) window.history.pushState(null, "", target);
  else window.history.replaceState(null, "", target);
}

export function useDashboardState() {
  const params = useSearchParams();
  const pathname = usePathname();

  const state = useMemo(() => {
    const out = {} as DashboardState;
    for (const [key, name] of Object.entries(PARAMS)) out[key as keyof DashboardState] = params.get(name);
    return out;
  }, [params]);

  const href = useCallback((patch: StatePatch) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      const name = PARAMS[key as keyof DashboardState];
      if (value === null || value === undefined || value === "") next.delete(name);
      else next.set(name, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [params, pathname]);

  const update = useCallback((patch: StatePatch, { push = false }: { push?: boolean } = {}) => {
    navigate(href(patch), { push });
  }, [href]);

  return { state, href, update };
}
