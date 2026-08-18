/**
 * /profil — Kullanıcının rozetleri, ilerlemesi ve başvuru durumu
 *
 * Oturum gerektirir. Oturumsuz ziyaretçi katılım sayfasına yönlendirilir —
 * hata ekranı göstermek yerine yapması gereken şeye götürüyoruz
 * (brand.md §9.8: boş durumlar öğretir).
 */
import type {Metadata} from "next";
import {redirect} from "next/navigation";

import {CampBadges} from "@/components/profile/CampBadges";
import {AddressChip} from "@/components/ui/Address";
import {ButtonLink} from "@/components/ui/Button";
import {Card, Container, EmptyState, Pill} from "@/components/ui/Card";
import {getViewer} from "@/lib/auth/guards";
import {readProgress} from "@/lib/chain/client";
import {listCamps} from "@/lib/content/access";
import {db} from "@/lib/db";
import {t} from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: t.profile.title,
  // Kişisel sayfa — arama motorlarında yeri yok
  robots: {index: false, follow: false},
};

export default async function ProfilePage() {
  const viewer = await getViewer();

  if (!viewer.address) redirect("/katil");

  const camps = await listCamps();

  /* Her kamp için zincirden ilerleme oku (RPC düşerse boş dizi) */
  const campsWithProgress = await Promise.all(
    camps.map(async (camp) => ({
      ...camp,
      progress: camp.chainCampId
        ? await readProgress(
            viewer.address as `0x${string}`,
            camp.chainCampId,
            camp.weekCount,
          ).catch(() => new Array(camp.weekCount).fill(false) as boolean[])
        : (new Array(camp.weekCount).fill(false) as boolean[]),
    })),
  );

  /* Başvuru durumları */
  const applications = await db.application.findMany({
    where: {address: viewer.address},
    include: {camp: {select: {slug: true, name: true}}},
    orderBy: {createdAt: "desc"},
  });

  const totalBadges = campsWithProgress.reduce(
    (sum, camp) => sum + camp.progress.filter(Boolean).length,
    0,
  );

  return (
    <Container className="py-12 md:py-16">
      {/* ---------------- Kimlik ---------------- */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {viewer.nickname || t.profile.noNickname}
            </h1>
            <div className="mt-2">
              <AddressChip address={viewer.address} />
            </div>
            {viewer.nickname && (
              <div className="mt-4">
                <ButtonLink
                  href={`/profil/${encodeURIComponent(viewer.nickname)}`}
                  variant="secondary"
                  size="sm"
                >
                  Herkese açık portfolyomu gör →
                </ButtonLink>
              </div>
            )}
          </div>

          {totalBadges > 0 && (
            <div className="text-right">
              <p className="text-4xl font-extrabold text-reward">{totalBadges}</p>
              <p className="text-sm text-fg-secondary">{t.profile.badges}</p>
            </div>
          )}
        </div>

        {/* Zincir okunamadı: nick isteme, durumu söyle (bkz. lib/auth/guards.ts) */}
        {viewer.nicknameUnknown && (
          <div className="mt-4 rounded-lg border border-warning bg-subtle p-4">
            <p className="text-sm font-semibold text-warning">
              Zincire şu an ulaşılamıyor
            </p>
            <p className="mt-1 text-sm text-fg-secondary">
              {t.errors.chainUnreachable}
            </p>
          </div>
        )}

        {!viewer.hasNickname && !viewer.nicknameUnknown && (
          <div className="mt-4 rounded-lg border border-line-accent bg-subtle p-4">
            <p className="text-sm font-semibold">{t.profile.noNickname}</p>
            <p className="mt-1 text-sm text-fg-secondary">
              {t.errors.nicknameRequired}
            </p>
            <div className="mt-3">
              <ButtonLink href="/katil" variant="accent" size="sm">
                {t.locked.noNickname.cta}
              </ButtonLink>
            </div>
          </div>
        )}
      </header>

      {/* ---------------- Başvurular ---------------- */}
      {applications.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold tracking-tight">
            Başvurularım
          </h2>
          <div className="flex flex-col gap-2">
            {applications.map((application) => (
              <Card key={application.id} className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{application.camp.name}</p>
                    <p className="text-sm text-fg-secondary">
                      Beyan edilen hafta: {application.declaredWeek}
                      {application.reviewNote && ` · ${application.reviewNote}`}
                    </p>
                  </div>

                  <Pill
                    tone={
                      application.status === "APPROVED"
                        ? "accent"
                        : application.status === "REJECTED"
                          ? "danger"
                          : "muted"
                    }
                  >
                    {application.status === "APPROVED"
                      ? t.profile.applicationApproved
                      : application.status === "REJECTED"
                        ? t.profile.applicationRejected
                        : t.profile.applicationPending}
                  </Pill>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Rozetler ---------------- */}
      <section>
        <h2 className="mb-4 text-lg font-bold tracking-tight">
          {t.profile.badges}
        </h2>

        {camps.length === 0 ? (
          <EmptyState title={t.camp.noWeeksYet} />
        ) : (
          <div className="flex flex-col gap-6">
            {campsWithProgress.map((camp) => (
              <CampBadges
                key={camp.id}
                campId={camp.chainCampId ?? camp.id}
                campSlug={camp.slug}
                campName={camp.name}
                weekCount={camp.weekCount}
                progress={camp.progress}
              />
            ))}
          </div>
        )}
      </section>

      {applications.length === 0 && totalBadges === 0 && (
        <div className="mt-8">
          <EmptyState
            title={t.profile.noBadges}
            description={t.profile.noBadgesHelp}
            action={
              <ButtonLink href="/katil" variant="accent">
                {t.nav.join}
              </ButtonLink>
            }
          />
        </div>
      )}
    </Container>
  );
}
