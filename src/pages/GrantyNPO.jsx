import { serviceCategories } from "../lib/servicesData";
import ServicePageTemplate from "../components/ServicePageTemplate";

export default function GrantyNPO() {
  return <ServicePageTemplate category={serviceCategories[5]} />;
}