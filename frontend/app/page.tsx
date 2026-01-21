import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { TestimonialHighlight } from "@/components/landing/TestimonialHighlight";
import { SolutionIntro } from "@/components/landing/SolutionIntro";
import { ArchitectureDiagram } from "@/components/landing/ArchitectureDiagram";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { DifferentialsSection } from "@/components/landing/DifferentialsSection";
import { TechnicalArchitectureSection } from "@/components/landing/TechnicalArchitectureSection";
import { OperationalFlowSection } from "@/components/landing/OperationalFlowSection";
import { RealScenariosSection } from "@/components/landing/RealScenariosSection";
import { MetricsSection } from "@/components/landing/MetricsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { PlansIncludesSection } from "@/components/landing/PlansIncludesSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";

export default function Page() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <TestimonialHighlight />
      <SolutionIntro />
      <ArchitectureDiagram />
      <ComparisonSection />
      <DifferentialsSection />
      <TechnicalArchitectureSection />
      <OperationalFlowSection />
      <RealScenariosSection />
      <MetricsSection />
      <TestimonialsSection />
      <PricingSection />
      <PlansIncludesSection />
      <FinalCTASection />
    </main>
  );
}
