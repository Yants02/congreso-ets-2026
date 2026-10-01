import { Suspense } from "react";
import Header from "../components/Header/Header";
import Hero from "@/components/Hero/Hero";
import SobreCongreso from "@/components/Congreso/SobreCongreso";
import SectionCongreso from "@/components/SectionCongreso/SectionCongreso";
import SectionExperiencia from "@/components/SectionExperiencia/SectionExperiencia";
import SectionPrograma from "@/components/SectionPrograma/SectionPrograma";
import Footer from "@/components/Footer/Footer";
import PushSubscriptionBanner from "@/components/PushSubscriptionBanner";

export const metadata = {
  title: "Inicio | DETS 2026",
};

export default function Home() {
  return (
    <div className="pt-24">
      <Header />
      <Hero />
      <div className="max-w-7xl mx-auto px-4">
        <PushSubscriptionBanner />
      </div>
      <SobreCongreso />
      <Suspense fallback={<div>Cargando actividades...</div>}>
        <SectionCongreso />
      </Suspense>
      <SectionPrograma />
      <SectionExperiencia />
      <Footer />
    </div>
  );
}