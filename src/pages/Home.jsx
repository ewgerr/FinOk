import HeroSection from "../components/HeroSection";
import ForWhoSection from "../components/ForWhoSection";
import WhyFinokSection from "../components/WhyFinokSection";
import ServicesOverview from "../components/ServicesOverview";
import HowWeWorkSection from "../components/HowWeWorkSection";
import TestimonialsSection from "../components/TestimonialsSection";
import ConsultationSection from "../components/ConsultationSection";

const HERO_IMG = "https://media.base44.com/images/public/6a0f3d95a129fb21b5a871de/f31d629b5_generated_a318f4b5.png";

export default function Home() {
  return (
    <div>
      <HeroSection heroImage={HERO_IMG} />
      <ForWhoSection />
      <WhyFinokSection />
      <ServicesOverview />
      <HowWeWorkSection />
      <TestimonialsSection />
      <ConsultationSection freeOnly={true} />
    </div>
  );
}