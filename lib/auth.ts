export const SESSION_COOKIE = "prism_dashboard_session";

export type DashboardUser = {
  user_id: string;
  email: string;
  full_name: string;
  role: "SUPERVISOR" | "REGIONAL_STATISTICIAN" | "HQ" | "ADMIN";
  region_id: string | null;
  region_code: string | null;
  region_name: string | null;
  district_id: string | null;
  district_code: string | null;
  district_name: string | null;
  market_id: string | null;
  market_code: string | null;
  market_name: string | null;
  last_login_at: string | null;
};
