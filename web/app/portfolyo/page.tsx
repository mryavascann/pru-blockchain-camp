import type {Metadata} from "next";

import {Container, Card} from "@/components/ui/Card";
import {PortfolioSearch} from "./PortfolioSearch";

export const metadata: Metadata = {
  title: "Katılımcı Portfolyoları",
  description: "Bir PRU kamp katılımcısının tamamladığı kampları ve haftalık ilerlemesini nickiyle görüntüle.",
};

export default function PortfolioSearchPage() {
  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-accent-text">Zincir üstü öğrenme izi</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Bir nick, bütün kamp yolculuğu.</h1>
        <p className="mx-auto mt-4 max-w-xl text-fg-secondary">Katılımcının hangi kampları tamamladığını, şu an kaçıncı haftada olduğunu ve cüzdanına aldığı rozetleri görüntüle.</p>
      </div>
      <Card accent className="mx-auto mt-9 max-w-2xl">
        <PortfolioSearch />
      </Card>
      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
        {[{n: "01", t: "Nicki yaz", d: "Cüzdan adresi aramana gerek yok."}, {n: "02", t: "İlerlemeyi gör", d: "Kamp ve hafta bilgisi tek ekranda."}, {n: "03", t: "Paylaş", d: "Her katılımcının kalıcı profil bağlantısı var."}].map((item) => (
          <div key={item.n} className="rounded-lg border border-line bg-surface p-4">
            <span className="font-mono text-xs text-accent-text">{item.n}</span>
            <h2 className="mt-2 font-bold">{item.t}</h2>
            <p className="mt-1 text-sm text-fg-secondary">{item.d}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}

