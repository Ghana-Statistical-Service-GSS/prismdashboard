// PPI accounts as returned by /api/v1/ppi/dashboard/users and /places
// (prism_backend ppi/services/users.service.js).
export type PpiRole = "MARKET_READER" | "SUPERVISOR" | "REGIONAL_STATISTICIAN";

export type PpiUser = {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: PpiRole;
  program: "PPI";
  isActive: boolean;
  regionId: string | null;
  regionName: string | null;
  districtId: string | null;
  districtName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeAssignments: number;
  // Enumerators only.
  device: { status: "ACTIVE" | "UNLOCKED" | "REVOKED" | "NEVER_BOUND"; lastSeenAt: string | null } | null;
};

export type PpiUserList = {
  scope: { level: "NATIONAL" | "REGION"; regionId: string | null };
  canManage: boolean;
  total: number;
  page: number;
  pageSize: number;
  items: PpiUser[];
};

export type PpiPlaces = {
  regions: { id: string; name: string }[];
  districts: { id: string; name: string; regionId: string }[];
};

export const ROLE_LABEL: Record<PpiRole, string> = {
  MARKET_READER: "Enumerator",
  SUPERVISOR: "Supervisor",
  REGIONAL_STATISTICIAN: "Regional Statistician",
};
