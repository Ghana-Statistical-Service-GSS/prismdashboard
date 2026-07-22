import { ConfigurationCatalogue } from "@/components/configuration/ConfigurationCatalogue";

export default function OutletsPage() {
  return <ConfigurationCatalogue entity="outlets" title="Outlets" description="Outlets and their market hierarchy in the local PRISM database." columns={[{ key: "code", label: "Outlet code" }, { key: "name", label: "Outlet name" }, { key: "outlet_type", label: "Type" }, { key: "market_name", label: "Market" }, { key: "district_name", label: "District" }, { key: "region_name", label: "Region" }, { key: "contact_name", label: "Contact" }, { key: "contact_phone", label: "Phone" }, { key: "is_active", label: "Status" }]} />;
}
