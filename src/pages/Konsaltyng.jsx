import { serviceCategories } from "../lib/servicesData";
import ServicePageTemplate from "../components/ServicePageTemplate";

export default function Konsaltyng() {
  return <ServicePageTemplate category={serviceCategories[4]} />;
}