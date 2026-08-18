/**
 * ============================================================================
 * /api/notes — Ortak ders notları
 *
 *   GET  ?camp=developers[&week=3][&kind=TERIM]  → görünür notlar
 *   POST                                          → yeni not
 *
 * ---------------------------------------------------------------------------
 * KİLİT NEREDE UYGULANIYOR
 *
 * Notlar hafta içeriğinden söz eder; dolayısıyla hafta içeriğiyle AYNI
 * kilide tabidir. 5. haftanın notunu okumak, 5. haftayı okumakla eş
 * değerdedir — kişi oraya gelmediyse görmemeli.
 *
 * Bu yüzden `upToWeek` sınırı SORGUYA giriyor (`lib/notes/service.ts`),
 * arayüzdeki bir filtreye değil. İleri haftaların notları sunucudan hiç
 * çıkmaz.
 * ---------------------------------------------------------------------------
 */
import {db} from "@/lib/db";
import {requireViewer} from "@/lib/auth/guards";
import {getCampBySlug} from "@/lib/content/access";
import {getCampProgress, canSeeWeek} from "@/lib/notes/progress";
import {createNote, listNotes} from "@/lib/notes/service";
import {isNoteKind, validateNote, type NoteKind} from "@/lib/notes/rules";
import {fail, handle, ok, readJson} from "@/lib/api";
import {t} from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Bir kişinin tek bir hafta için yazabileceği en fazla not sayısı.
 *
 * Zorunluluk bir şeyi açtığı için, sistemi "on tane iki satırlık not"la
 * doldurma dürtüsü doğabilir. Sınır bunu keser ama gerçek katkıyı
 * engellemez — bir haftada altı ayrı kayda değer şey öğrenmek zaten çok.
 */
const MAX_NOTES_PER_WEEK = 6;

/* -------------------------------------------------------------------------- */
/*                                   OKUMA                                    */
/* -------------------------------------------------------------------------- */

export async function GET(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();
    const params = new URL(request.url).searchParams;

    const campSlug = params.get("camp");
    if (!campSlug) {
      return fail("Kamp belirtilmedi (?camp=developers).", 400, "MISSING_CAMP");
    }

    const camp = await getCampBySlug(campSlug);
    if (!camp) return fail("Böyle bir kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    /*
     * "Nick yok" ile "nick durumu okunamadı" ayrı şeyler. İkincisinde kapıyı
     * nick eksikliğine bağlamak yanlış olur — kişinin nicki olabilir.
     */
    if (viewer.nicknameUnknown && !viewer.isAdmin) {
      return fail(t.errors.chainUnreachable, 503, "CHAIN_UNREACHABLE");
    }

    if (!viewer.hasNickname && !viewer.isAdmin) {
      return fail(
        "Not defterini görmek için önce bir nick belirlemen gerekiyor.",
        403,
        "NICKNAME_REQUIRED",
      );
    }

    const progress = await getCampProgress(
      viewer.address,
      camp.id,
      camp.weekCount,
      viewer.isAdmin,
    );

    const weekParam = params.get("week");
    const weekNumber = weekParam ? Number(weekParam) : undefined;
    if (weekParam && !Number.isInteger(weekNumber)) {
      return fail("Hafta numarası geçersiz.", 400, "BAD_WEEK");
    }

    const kindParam = params.get("kind");
    const kind: NoteKind | undefined = isNoteKind(kindParam)
      ? kindParam
      : undefined;

    const notes = await listNotes(
      camp.id,
      progress.visibleWeek,
      viewer.address,
      {weekNumber, kind},
    );

    return ok({
      camp: {id: camp.id, slug: camp.slug, name: camp.name, weekCount: camp.weekCount},
      notes,
      progress: {
        entitledWeek: progress.entitledWeek,
        entryWeek: progress.entryWeek,
        visibleWeek: progress.visibleWeek,
        owedWeeks: progress.owedWeeks,
        notedWeeks: progress.notedWeeks,
        blockingWeek: progress.blockingWeek,
        nextWeekAt: progress.nextWeekAt?.toISOString() ?? null,
      },
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                                   YAZMA                                    */
/* -------------------------------------------------------------------------- */

type CreateBody = {
  campSlug?: string;
  weekNumber?: number;
  kind?: string;
  title?: string;
  body?: string;
  sourceUrl?: string | null;
  aiAssisted?: boolean;
};

export async function POST(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();

    /*
     * Nick zorunlu: not defterinde yazar adı nickle görünür. Nicksiz not,
     * ekranda sahipsiz bir metin olurdu.
     */
    if (viewer.nicknameUnknown) {
      return fail(t.errors.chainUnreachable, 503, "CHAIN_UNREACHABLE");
    }

    if (!viewer.hasNickname) {
      return fail(
        "Not bırakmadan önce bir nick belirlemen gerekiyor.",
        403,
        "NICKNAME_REQUIRED",
      );
    }

    const payload = (await readJson<CreateBody>(request)) ?? {};

    if (!payload.campSlug) {
      return fail("Kamp belirtilmedi.", 400, "MISSING_CAMP");
    }
    if (!Number.isInteger(payload.weekNumber) || payload.weekNumber! < 1) {
      return fail("Hafta numarası geçersiz.", 400, "BAD_WEEK");
    }

    const camp = await getCampBySlug(payload.campSlug);
    if (!camp) return fail("Böyle bir kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    const weekNumber = payload.weekNumber!;
    if (weekNumber > camp.weekCount) {
      return fail(
        `"${camp.name}" ${camp.weekCount} haftalık.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    /* ---- İLERLEME KAPISI: görmediğin haftaya not yazamazsın ---- */
    const progress = await getCampProgress(
      viewer.address,
      camp.id,
      camp.weekCount,
      viewer.isAdmin,
    );

    if (!canSeeWeek(progress, weekNumber)) {
      return fail(
        progress.entitledWeek === 0
          ? "Bu kampta henüz onaylı bir haftan yok. Başvurun onaylandığında not bırakabilirsin."
          : `${weekNumber}. haftaya henüz gelmedin. Şu an ${progress.visibleWeek}. haftadasın.`,
        403,
        "WEEK_LOCKED",
      );
    }

    /* ---- İçerik doğrulaması (aynı kural formda da çalışıyor) ---- */
    const validation = validateNote({
      kind: payload.kind ?? "",
      title: payload.title ?? "",
      body: payload.body ?? "",
      sourceUrl: payload.sourceUrl,
      aiAssisted: payload.aiAssisted,
    });

    if (!validation.ok) {
      return fail(validation.error, 400, "VALIDATION_ERROR");
    }

    /* ---- Spam sınırı ---- */
    const existing = await db.weekNote.count({
      where: {
        address: viewer.address!.toLowerCase(),
        campId: camp.id,
        weekNumber,
      },
    });
    if (existing >= MAX_NOTES_PER_WEEK) {
      return fail(
        `Bir hafta için en fazla ${MAX_NOTES_PER_WEEK} not bırakabilirsin. ` +
          "Eklemek istediğin varsa mevcut notlarından birini düzenle.",
        429,
        "TOO_MANY_NOTES",
      );
    }

    const note = await createNote({
      campId: camp.id,
      weekNumber,
      address: viewer.address!,
      authorNickname: viewer.nickname,
      ...validation.value,
    });

    /*
     * Not bu haftanın rozet kapısını tamamladı. Sonraki hafta yönetici
     * ilerlemeyi işaretlediyse hemen açılabilir; henüz işaretlenmediyse
     * kişisel planlanan açılış zamanını da arayüze döndürüyoruz.
     */
    const after = await getCampProgress(
      viewer.address,
      camp.id,
      camp.weekCount,
      viewer.isAdmin,
    );

    return ok({
      note,
      unlocked: {
        /** Bu haftanın rozeti artık alınabilir mi? */
        badgeForWeek: weekNumber,
        /** Yeni görünür sınır */
        visibleWeek: after.visibleWeek,
        /** Bu notla yeni bir hafta açıldı mı? */
        openedWeek:
          after.visibleWeek > progress.visibleWeek ? after.visibleWeek : null,
        owedWeeks: after.owedWeeks,
        nextWeekAt: after.nextWeekAt?.toISOString() ?? null,
      },
    });
  });
}
