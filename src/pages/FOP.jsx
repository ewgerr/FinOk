import { serviceCategories } from "../lib/servicesData";
import ServicePageTemplate from "../components/ServicePageTemplate";

export default function FOP() {
  return <ServicePageTemplate category={serviceCategories[1]} />;
}