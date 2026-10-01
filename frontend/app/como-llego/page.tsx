import { Suspense } from "react";
import Header from "@/components/Header/Header";
import ComoLlego from "@/components/ComoLlego/ComoLlego";
import Footer from "@/components/Footer/Footer";

export const metadata = {
  title: "Cómo llego | DETS 2026",
};

export default function ComoLlegoPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow pt-24">
        <Suspense fallback={<div>Cargando mapa...</div>}>
          <ComoLlego />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
