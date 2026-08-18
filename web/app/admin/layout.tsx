/**
 * Admin paneli düzeni ve yetki kapısı.
 *
 * ⚠️ KORUMA SUNUCUDA. Yetkisiz ziyaretçi için alt sayfalar HİÇ RENDER
 * EDİLMEZ — "gizle" değil, "üretme". Bir client-side kontrol, verinin
 * tarayıcıya gitmesini gerektirirdi.
 *
 * Yetki kaynağı `ADMIN_ADDRESSES` ortam değişkeni; kontratın `owner()`
 * fonksiyonu DEĞİL. Gerekçe: kontrat sahibi zincir işlemlerini yapan
 * cüzdandır (ileride donanım cüzdanı olacak). Admin paneli ise başvuru
 * onaylama, senkron tetikleme gibi ZİNCİR DIŞI işler yapar; bunlar için
 * soğuk cüzdanı her seferinde bağlamak anlamsız.
 */
import Link from "next/link";

import {ButtonLink} from "@/components/ui/Button";
import {Container, EmptyState, Pill} from "@/components/ui/Card";
import {WalletGateButton} from "@/components/wallet/ConnectButton";
import {getViewer} from "@/lib/auth/guards";
import {t} from "@/lib/i18n";
import {AdminNav} from "./AdminNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t.admin.title,
  robots: {index: false, follow: false},
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  /* ---- Oturum yok ---- */
  if (!viewer.address) {
    return (
      <Container prose className="py-16">
        <EmptyState
          title="Cüzdanını bağlaman gerekiyor"
          description="Yönetim paneline erişmek için önce giriş yap."
          action={
            <WalletGateButton continueTo="/admin" size="md">
              {t.wallet.connect}
            </WalletGateButton>
          }
        />
      </Container>
    );
  }

  /* ---- Yetkisiz ---- */
  if (!viewer.isAdmin) {
    return (
      <Container prose className="py-16">
        <EmptyState
          title={t.errors.forbidden}
          description={
            `Bağlı cüzdan (${viewer.address.slice(0, 6)}…${viewer.address.slice(-4)}) ` +
            `yönetici listesinde değil. Yetki gerekiyorsa kulüp yöneticisiyle konuş.`
          }
          action={
            <ButtonLink href="/" variant="secondary">
              Ana sayfaya dön
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-10 md:py-14">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            {t.admin.title}
          </h1>
          <Pill tone="accent">{viewer.nickname || "yönetici"}</Pill>
        </div>
        <p className="mt-1 text-sm text-fg-secondary">
          Başvuru onayı, içerik yönetimi ve merkle ağaçları.{" "}
          <Link href="/" className="underline underline-offset-2">
            Siteye dön
          </Link>
        </p>
      </header>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </Container>
  );
}
