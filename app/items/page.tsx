import { ConfigurationCatalogue } from "@/components/configuration/ConfigurationCatalogue";

export default function ItemsPage() {
  return <ConfigurationCatalogue entity="items" title="Items" description="CPI items, classifications, and units of measure in the local PRISM database." columns={[{ key: "code", label: "Item code" }, { key: "name", label: "Item name" }, { key: "item_description", label: "Description" }, { key: "imp_local", label: "Import / local" }, { key: "goods_and_services", label: "Goods / services" }, { key: "uom_nonstandardized", label: "Local UOM" }, { key: "uom_standardized", label: "Standard UOM" }, { key: "coicop06", label: "COICOP06" }, { key: "item_basket", label: "Basket" }, { key: "is_active", label: "Status" }]} />;
}
