import { serviceCategories } from "../lib/servicesData";
import ServicePageTemplate from "../components/ServicePageTemplate";

export default function TOV() {
  return <ServicePageTemplate category={serviceCategories[0]} />;
}