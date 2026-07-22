import { ConfigurationCatalogue } from "@/components/configuration/ConfigurationCatalogue";

export default function DistrictsPage() {
  return <ConfigurationCatalogue entity="districts" title="Districts" description="Districts and their corresponding regions in the local PRISM database." columns={[{ key: "code", label: "District code" }, { key: "name", label: "District name" }, { key: "region_name", label: "Region" }, { key: "classification", label: "Classification" }, { key: "market_count", label: "Markets" }]} />;
}
