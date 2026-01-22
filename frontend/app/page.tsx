import { Header } from "@/components/landing/Header"
import { Hero } from "@/components/landing/Hero"
import { Logos } from "@/components/landing/Logos"
import { Problems } from "@/components/landing/Problems"
import { Solution } from "@/components/landing/Solution"
import { Differentials } from "@/components/landing/Differentials"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Metrics } from "@/components/landing/Metrics"
import { Testimonials } from "@/components/landing/Testimonials"
import { Pricing } from "@/components/landing/Pricing"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { Footer } from "@/components/landing/Footer"

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Logos />
        <Problems />
        <Solution />
        <Differentials />
        <HowItWorks />
        <Metrics />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
