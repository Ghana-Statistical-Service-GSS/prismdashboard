export type OutletSize = "Small" | "Medium" | "Large";

export interface Market {
  id: string;
  name: string;
  district: string;
  region: string;
  supervisorId?: string; // Business rule: exactly one supervisor (or none)
}

export interface Outlet {
  id: string;
  name: string;
  marketId: string;
  region: string;
  category: OutletSize;
  readerIds?: string[]; // Business rule: Large outlets can have many, Small/Medium at most one
}
