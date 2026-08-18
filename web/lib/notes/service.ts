/**
 * ============================================================================
 * NOT DEFTERİ — veri katmanı
 *
 * Erişim kararları BURADA verilmez; `lib/notes/progress.ts` verir. Bu dosya
 * yalnızca "kararı verilmiş" okuma/yazma işlerini yapar. Ayrım bilinçli:
 * kural tek yerde dururken sorgu birden çok yerden çağrılabilir.
 *
 * ⚠️ `body` ve `title` DÜZ METİN olarak saklanır ve düz metin olarak döner.
 * HTML'e çevrilmez, sanitize edilmez, kırpılmaz. Ekranda React metin düğümü
 * olarak basılır (bkz. components/notes/NoteBody.tsx). Bu dosyanın çıktısını
 * `dangerouslySetInnerHTML` içine koymak XSS açar.
 * ============================================================================
 */
import {db} from "@/lib/db";
import type {NoteKind} from "./rules";

export type PublicNote = {
  id: string;
  campId: number;
  weekNumber: number;
  kind: NoteKind;
  title: string;
  body: string;
  sourceUrl: string | null;
  aiAssisted: boolean;
  authorNickname: string;
  /** Görüntüleyen kişi bu notun yazarı mı? (düzenleme düğmesi için) */
  isMine: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Yazarın cüzdan adresi ARAYÜZE GÖNDERİLMEZ.
 *
 * Not defteri herkese açık bir okuma alanı; kimin ne yazdığı nickle
 * yeterince belli. Adresi de yayınlamak, bir kişinin tüm zincir geçmişini
 * notlarıyla eşleştirmeyi kolaylaştırır — gereksiz bir maruziyet.
 * Sıralama sayfası adresi gösteriyor ama orası kişinin kendi rızasıyla
 * girdiği bir vitrin; not yazmak öyle değil, zorunlu.
 */
const NOTE_FIELDS = {
  id: true,
  campId: true,
  weekNumber: true,
  kind: true,
  title: true,
  body: true,
  sourceUrl: true,
  aiAssisted: true,
  authorNickname: true,
  address: true,
  createdAt: true,
  updatedAt: true,
} as const;

type NoteRow = {
  id: string;
  campId: number;
  weekNumber: number;
  kind: string;
  title: string;
  body: string;
  sourceUrl: string | null;
  aiAssisted: boolean;
  authorNickname: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
};

function toPublic(row: NoteRow, viewerAddress: string | null): PublicNote {
  const {address, ...rest} = row;
  return {
    ...rest,
    kind: rest.kind as NoteKind,
    isMine: viewerAddress !== null && address === viewerAddress.toLowerCase(),
  };
}

/**
 * Bir kampın notlarını döner — YALNIZCA `upToWeek`'e kadar olanlar.
 *
 * `upToWeek` çağıran tarafından `CampProgress.visibleWeek` ile doldurulur.
 * Sorguya sınır olarak girmesi önemli: filtreleme arayüzde yapılsaydı,
 * ilerideki haftaların notları tarayıcıya gider ve kilit sahte olurdu.
 */
export async function listNotes(
  campId: number,
  upToWeek: number,
  viewerAddress: string | null,
  options: {weekNumber?: number; kind?: NoteKind} = {},
): Promise<PublicNote[]> {
  if (upToWeek < 1) return [];

  /* İstenen hafta görünür sınırın dışındaysa boş dön — sorgu bile atma */
  if (options.weekNumber !== undefined && options.weekNumber > upToWeek) {
    return [];
  }

  const rows = await db.weekNote.findMany({
    where: {
      campId,
      status: "VISIBLE",
      weekNumber:
        options.weekNumber !== undefined
          ? options.weekNumber
          : {lte: upToWeek},
      ...(options.kind ? {kind: options.kind} : {}),
    },
    orderBy: [{weekNumber: "asc"}, {createdAt: "desc"}],
    select: NOTE_FIELDS,
  });

  return rows.map((row) => toPublic(row as NoteRow, viewerAddress));
}

/** Hafta başına görünür not sayısı — müfredat sayfasındaki rozetler için */
export async function countNotesByWeek(
  campId: number,
  upToWeek: number,
): Promise<Map<number, number>> {
  if (upToWeek < 1) return new Map();

  const groups = await db.weekNote.groupBy({
    by: ["weekNumber"],
    where: {campId, status: "VISIBLE", weekNumber: {lte: upToWeek}},
    _count: true,
  });

  return new Map(groups.map((g) => [g.weekNumber, g._count]));
}

/** Bir kişinin bu hafta için notu var mı? */
export async function hasNoteForWeek(
  address: string,
  campId: number,
  weekNumber: number,
): Promise<boolean> {
  const count = await db.weekNote.count({
    where: {address: address.toLowerCase(), campId, weekNumber},
  });
  return count > 0;
}

export type NoteInput = {
  campId: number;
  weekNumber: number;
  address: string;
  authorNickname: string;
  kind: NoteKind;
  title: string;
  body: string;
  sourceUrl: string | null;
  aiAssisted: boolean;
};

export async function createNote(input: NoteInput): Promise<PublicNote> {
  const row = await db.weekNote.create({
    data: {
      campId: input.campId,
      weekNumber: input.weekNumber,
      address: input.address.toLowerCase(),
      authorNickname: input.authorNickname,
      kind: input.kind,
      title: input.title,
      body: input.body,
      sourceUrl: input.sourceUrl,
      aiAssisted: input.aiAssisted,
    },
    select: NOTE_FIELDS,
  });

  return toPublic(row as NoteRow, input.address);
}

/**
 * Bir notu günceller — YALNIZCA yazarı.
 *
 * Sahiplik kontrolü `where` içinde: yanlış adresle çağrılırsa Prisma sıfır
 * satır günceller ve `null` döneriz. Önce "oku, karşılaştır, yaz" yapsaydık
 * arada bir yarış penceresi kalırdı.
 */
export async function updateOwnNote(
  noteId: string,
  address: string,
  patch: {
    kind: NoteKind;
    title: string;
    body: string;
    sourceUrl: string | null;
    aiAssisted: boolean;
    authorNickname: string;
  },
): Promise<PublicNote | null> {
  const result = await db.weekNote.updateMany({
    where: {id: noteId, address: address.toLowerCase(), status: "VISIBLE"},
    data: patch,
  });

  if (result.count === 0) return null;

  const row = await db.weekNote.findUnique({
    where: {id: noteId},
    select: NOTE_FIELDS,
  });

  return row ? toPublic(row as NoteRow, address) : null;
}

/* -------------------------------------------------------------------------- */
/*                                  YÖNETİM                                   */
/* -------------------------------------------------------------------------- */

/**
 * Yönetim için tüm notlar — gizlenmiş olanlar dahil.
 *
 * Burada yazarın adresi de döner: yönetim bir spam notunu kimin yazdığını
 * görebilmeli.
 */
export async function listAllNotesForAdmin(options: {
  campId?: number;
  status?: "VISIBLE" | "HIDDEN";
} = {}) {
  return db.weekNote.findMany({
    where: {
      ...(options.campId ? {campId: options.campId} : {}),
      ...(options.status ? {status: options.status} : {}),
    },
    orderBy: {createdAt: "desc"},
    take: 300,
    select: {
      ...NOTE_FIELDS,
      status: true,
      camp: {select: {slug: true, name: true}},
    },
  });
}

/**
 * Bir notu gizler ya da geri açar.
 *
 * SİLMİYORUZ: gizlenen not veritabanında kalır. Bir katılımcının notu
 * yanlışlıkla gizlenirse geri alınabilsin, ve "neden benim notum yok"
 * sorusuna cevap verilebilsin.
 *
 * ⚠️ Gizlenen not, yazarının o hafta için NOT BORCUNU KAPATMAYA DEVAM EDER.
 * Gerekçe: `getCampProgress` not borcunu status'e bakmadan hesaplar. Aksi
 * halde yönetim bir notu gizlediğinde kullanıcının önceden açılmış haftası
 * aniden kapanır ve rozeti geri alınamaz hâle gelirdi — cezayı sessizce
 * uygulamak yerine yönetim kişiyle konuşmalı.
 */
export async function setNoteStatus(
  noteId: string,
  status: "VISIBLE" | "HIDDEN",
) {
  return db.weekNote.update({
    where: {id: noteId},
    data: {status},
    select: {id: true, status: true},
  });
}
