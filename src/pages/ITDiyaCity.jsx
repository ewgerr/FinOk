import { serviceCategories } from "../lib/servicesData";
import ServicePageTemplate from "../components/ServicePageTemplate";

export default function ITDiyaCity() {
  return <ServicePageTemplate category={serviceCategories[2]} />;
}