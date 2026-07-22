import { ConfigurationCatalogue } from "@/components/configuration/ConfigurationCatalogue";

export default function RegionsPage() {
  return <ConfigurationCatalogue entity="regions" title="Regions" description="Regions currently configured in the local PRISM database." columns={[{ key: "code", label: "Region code" }, { key: "name", label: "Region name" }, { key: "district_count", label: "Districts" }, { key: "market_count", label: "Markets" }]} />;
}
