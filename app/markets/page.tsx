import { ConfigurationCatalogue } from "@/components/configuration/ConfigurationCatalogue";

export default function MarketsPage() {
  return <ConfigurationCatalogue entity="markets" title="Markets" description="Markets mapped to their districts and regions in the local PRISM database." columns={[{ key: "code", label: "Market code" }, { key: "name", label: "Market name" }, { key: "district_name", label: "District" }, { key: "region_name", label: "Region" }, { key: "location_description", label: "Location" }, { key: "classification", label: "Classification" }, { key: "outlet_count", label: "Outlets" }]} />;
}
