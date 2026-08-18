/**
 * ============================================================================
 * ORTAK NOT DEFTERİ — UÇTAN UCA TEST
 *
 * İki bölüm:
 *
 *   BÖLÜM 1  Kuralın kendisi. İstekteki senaryo adım adım kuruluyor ve her
 *            adımda hangi haftanın açık, hangi rozetin alınabilir olduğu
 *            doğrulanıyor. Karar `lib/notes/progress.ts` içinde veriliyor;
 *            test de tam oraya bakıyor.
 *
 *   BÖLÜM 2  HTTP yüzeyi. Oturumsuz istek, nick şartı, doğrulama kuralları
 *            ve `/api/proofs`'un not borçlu haftanın proof'unu SAKLAMASI.
 *
 * Test gerçek Neon veritabanına yazar. Kullandığı adresler her çalıştırmada
 * rastgele üretilir ve sonunda TEMİZLENİR — mevcut veriye dokunmaz.
 *
 * Çalıştırma:  npm run test:notes   (dev sunucusu ayakta olmalı)
 * ============================================================================
 */
import {privateKeyToAccount} from "viem/accounts";
import {createSiweMessage} from "viem/siwe";

import {db} from "../lib/db";
import {
  canClaimWeek,
  canSeeWeek,
  getCampProgress,
  splitByNoteDebt,
  weekLock,
} from "../lib/notes/progress";
import {listNotes} from "../lib/notes/service";
import {safeUrl, validateNote} from "../lib/notes/rules";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const DOMAIN = new URL(BASE).host;

let fails = 0;
let skipped = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
  if (!ok) fails += 1;
}

function skip(label: string, why: string) {
  console.log(`  ATLA ${label} -> ${why}`);
  skipped += 1;
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

/** Testin kendi adresi — çakışma olmasın diye rastgele */
function randomAddress(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

const ALICE = randomAddress();
const BOB = randomAddress();

/** Uzun ve anlamlı bir gövde — BODY_MIN sınırını geçmeli */
const BODY =
  "Bu hafta idempotent kelimesini anlamamistim. Arastirdim: bir islemi bir " +
  "kez de yapsan on kez de yapsan sonucun degismemesi demekmis. Ornekle " +
  "oturdu kafama.";

async function main() {
  console.log("\nORTAK NOT DEFTERI — UCTAN UCA TEST");
  console.log("=".repeat(64));

  const camp = await db.camp.findFirst({orderBy: {displayOrder: "asc"}});
  if (!camp) {
    console.log("Kamp bulunamadi. Once `npm run db:seed` calistir.");
    process.exit(1);
  }
  console.log(`Kamp: ${camp.name} (id=${camp.id}, ${camp.weekCount} hafta)`);
  console.log(`Alice: ${ALICE}`);

  await cleanup();

  /* ====================================================================== */
  section("BOLUM 1 — KURAL (istekteki senaryo)");
  /* ====================================================================== */

  /* ---- Adim 0: hicbir sey yok ---- */
  let p = await getCampProgress(ALICE, camp.id, camp.weekCount);
  check("basvurusu olmayan kisi hicbir haftayi goremez", p.visibleWeek === 0);
  check(
    "kilit sebebi 'not-approved'",
    weekLock(p, 1).kind === "not-approved",
    weekLock(p, 1).kind,
  );

  /* ---- Adim 1: 3. haftadan katildi, 1-2-3 hak edildi ---- */
  await db.application.create({
    data: {
      address: ALICE,
      campId: camp.id,
      declaredWeek: 3,
      status: "APPROVED",
      nickname: "alice_test",
    },
  });
  await db.weeklyCompletion.createMany({
    data: [1, 2, 3].map((weekNumber) => ({
      address: ALICE,
      campId: camp.id,
      weekNumber,
      source: "backfill",
    })),
    skipDuplicates: true,
  });

  p = await getCampProgress(ALICE, camp.id, camp.weekCount);
  check("giris haftasi 3 olarak okundu", p.entryWeek === 3, `entryWeek=${p.entryWeek}`);
  check("hak edilen hafta 3", p.entitledWeek === 3, `entitled=${p.entitledWeek}`);
  check(
    "1-2-3 gorunuyor, 4 gorunmuyor",
    canSeeWeek(p, 1) && canSeeWeek(p, 2) && canSeeWeek(p, 3) && !canSeeWeek(p, 4),
  );
  check(
    "not borcu YALNIZCA 3. hafta (1-2 geri doldurma)",
    JSON.stringify(p.owedWeeks) === "[3]",
    `owed=${JSON.stringify(p.owedWeeks)}`,
  );
  check(
    "1. ve 2. hafta rozetleri serbest",
    canClaimWeek(p, 1) && canClaimWeek(p, 2),
  );
  check("3. hafta rozeti KAPALI (not bekliyor)", !canClaimWeek(p, 3));
  check(
    "4. hafta sebebi 'not-reached' (kamp oraya gelmedi, not degil)",
    weekLock(p, 4).kind === "not-reached",
    weekLock(p, 4).kind,
  );

  /* ---- Adim 2: bir hafta gecti, yonetim 4. haftayi acti ---- */
  await db.weeklyCompletion.create({
    data: {address: ALICE, campId: camp.id, weekNumber: 4, source: "weekly"},
  });

  p = await getCampProgress(ALICE, camp.id, camp.weekCount);
  check("hak edilen hafta 4 oldu", p.entitledWeek === 4);
  check(
    "not borcu [3, 4]",
    JSON.stringify(p.owedWeeks) === "[3,4]",
    `owed=${JSON.stringify(p.owedWeeks)}`,
  );
  check(
    "4. hafta HALA KAPALI — 3'un notu yazilmadi",
    !canSeeWeek(p, 4),
    `visible=${p.visibleWeek}`,
  );
  const lock4 = weekLock(p, 4);
  check(
    "4. haftanin sebebi artik 'note-required' ve engelleyen hafta 3",
    lock4.kind === "note-required" &&
      "blockingWeek" in lock4 &&
      lock4.blockingWeek === 3,
    JSON.stringify(lock4),
  );

  /* ---- Adim 3: 3. haftanin notu yazildi ---- */
  await db.weekNote.create({
    data: {
      campId: camp.id,
      weekNumber: 3,
      address: ALICE,
      authorNickname: "alice_test",
      kind: "TERIM",
      title: "Idempotent ne demek?",
      body: BODY,
      aiAssisted: true,
    },
  });

  p = await getCampProgress(ALICE, camp.id, camp.weekCount);
  check("not sonrasi 4. hafta ACILDI", canSeeWeek(p, 4), `visible=${p.visibleWeek}`);
  check("3. hafta rozeti ACILDI", canClaimWeek(p, 3));
  check(
    "simdi borc yalnizca 4. hafta",
    JSON.stringify(p.owedWeeks) === "[4]",
    `owed=${JSON.stringify(p.owedWeeks)}`,
  );
  check("4. hafta rozeti hala kapali", !canClaimWeek(p, 4));
  check(
    "5. hafta 'not-reached' (kamp oraya gelmedi)",
    weekLock(p, 5).kind === "not-reached",
    weekLock(p, 5).kind,
  );

  /* ---- Adim 4: yonetici her seyi gorur ---- */
  const adminProgress = await getCampProgress(ALICE, camp.id, camp.weekCount, true);
  check(
    "yonetici tum haftalari gorur",
    adminProgress.visibleWeek === camp.weekCount &&
      adminProgress.owedWeeks.length === 0,
  );

  /* ====================================================================== */
  section("BOLUM 1b — NOT LISTESI SINIRI (sorguda mi, arayuzde mi?)");
  /* ====================================================================== */

  /* Bob ileri haftalara not birakti; Alice bunlari GORMEMELI */
  await db.weekNote.createMany({
    data: [3, 5, 7].map((weekNumber) => ({
      campId: camp.id,
      weekNumber,
      address: BOB,
      authorNickname: "bob_test",
      kind: "OZET" as const,
      title: `Bob'un ${weekNumber}. hafta notu`,
      body: BODY,
    })),
  });

  p = await getCampProgress(ALICE, camp.id, camp.weekCount);
  const aliceSees = await listNotes(camp.id, p.visibleWeek, ALICE);
  const maxWeekSeen = Math.max(...aliceSees.map((n) => n.weekNumber), 0);

  check(
    `Alice yalnizca ${p.visibleWeek}. haftaya kadarki notlari aliyor`,
    maxWeekSeen <= p.visibleWeek,
    `en yuksek gorunen hafta=${maxWeekSeen}`,
  );
  check(
    "Bob'un 5. ve 7. hafta notlari SORGUYA HIC GIRMEDI",
    !aliceSees.some((n) => n.weekNumber === 5 || n.weekNumber === 7),
  );
  check(
    "Bob'un 3. hafta notu gorunuyor (o hafta acik)",
    aliceSees.some((n) => n.weekNumber === 3 && n.authorNickname === "bob_test"),
  );
  check(
    "kendi notu 'isMine' olarak isaretli",
    aliceSees.some((n) => n.authorNickname === "alice_test" && n.isMine),
  );
  check(
    "baskasinin notu 'isMine' DEGIL",
    aliceSees.every((n) => n.authorNickname !== "bob_test" || !n.isMine),
  );
  check(
    "yazar adresi arayuze GONDERILMIYOR",
    aliceSees.every((n) => !("address" in n)),
  );

  /* ====================================================================== */
  section("BOLUM 1c — ICERIK DOGRULAMA VE BAGLANTI GUVENLIGI");
  /* ====================================================================== */

  check(
    "javascript: baglantisi reddedildi",
    safeUrl("javascript:alert(1)") === null,
  );
  check(
    "data: baglantisi reddedildi",
    safeUrl("data:text/html,<script>alert(1)</script>") === null,
  );
  check("https baglantisi kabul edildi", safeUrl("https://ornek.com/a") !== null);
  check("bos baglanti null", safeUrl("   ") === null);

  check(
    "kisa not reddedildi",
    validateNote({kind: "OZET", title: "Baslik burada", body: "kisa"}).ok === false,
  );
  check(
    "20 karakterlik not kabul edildi",
    validateNote({
      kind: "OZET",
      title: "Baslik burada",
      body: "12345678901234567890",
    }).ok === true,
  );
  check(
    "19 karakterlik not reddedildi",
    validateNote({
      kind: "OZET",
      title: "Baslik burada",
      body: "1234567890123456789",
    }).ok === false,
  );
  check(
    "kisa baslik reddedildi",
    validateNote({kind: "OZET", title: "ab", body: BODY}).ok === false,
  );
  check(
    "gecersiz tur reddedildi",
    validateNote({kind: "SACMA", title: "Baslik burada", body: BODY}).ok === false,
  );
  check(
    "KAYNAK turu baglanti olmadan reddedildi",
    validateNote({kind: "KAYNAK", title: "Faydali video", body: BODY}).ok === false,
  );
  check(
    "KAYNAK turu baglantiyla kabul edildi",
    validateNote({
      kind: "KAYNAK",
      title: "Faydali video",
      body: BODY,
      sourceUrl: "https://ornek.com/video",
    }).ok === true,
  );
  check(
    "javascript: baglantili not reddedildi",
    validateNote({
      kind: "TERIM",
      title: "Baslik burada",
      body: BODY,
      sourceUrl: "javascript:alert(1)",
    }).ok === false,
  );

  const xss = validateNote({
    kind: "TERIM",
    title: "Baslik burada",
    body: `<script>alert(1)</script> ${BODY}`,
  });
  check(
    "HTML iceren not KABUL edilir (metin olarak saklanir, ekranda kacisla basilir)",
    xss.ok === true && xss.value.body.includes("<script>"),
  );

  /* ====================================================================== */
  section("BOLUM 1d — PROOF SAKLAMA (rozet kapisinin kendisi)");
  /* ====================================================================== */

  const fakeProof = ["0xaa", "0xbb"] as `0x${string}`[];
  const split = splitByNoteDebt(
    [
      {weekNumber: 1, proof: fakeProof, alreadyClaimed: false},
      {weekNumber: 2, proof: fakeProof, alreadyClaimed: false},
      {weekNumber: 3, proof: fakeProof, alreadyClaimed: false},
      {weekNumber: 4, proof: fakeProof, alreadyClaimed: true},
    ],
    [3, 4], // 3 ve 4 icin not borcu var
  );

  check(
    "borclu 3. haftanin PROOF'U BOSALTILDI",
    split.weeks.find((w) => w.weekNumber === 3)!.proof.length === 0,
  );
  check(
    "borcsuz 1. haftanin proof'u KORUNDU",
    split.weeks.find((w) => w.weekNumber === 1)!.proof.length === 2,
  );
  check(
    "claimBatch listesi yalnizca borcsuz ve alinmamis haftalar",
    JSON.stringify(split.readyWeekNumbers) === "[1,2]",
    JSON.stringify(split.readyWeekNumbers),
  );
  check(
    "gonderilen proof listesi hicbir bos dizi icermiyor",
    split.readyProofs.every((pr) => pr.length > 0),
  );
  check(
    "needsNote yalnizca borclu VE alinmamis haftalar (4 zaten alinmis)",
    JSON.stringify(split.needsNote) === "[3]",
    JSON.stringify(split.needsNote),
  );
  check(
    "readyWeekNumbers ve readyProofs ayni uzunlukta (claimBatch sarti)",
    split.readyWeekNumbers.length === split.readyProofs.length,
  );

  /* Gercek ilerlemeyle birlikte: Alice'in borcu [4] idi */
  const aliceSplit = splitByNoteDebt(
    [1, 2, 3, 4].map((weekNumber) => ({
      weekNumber,
      proof: fakeProof,
      alreadyClaimed: false,
    })),
    p.owedWeeks,
  );
  check(
    "Alice'in gercek borcuyla: 4. hafta saklandi, 1-2-3 acik",
    JSON.stringify(aliceSplit.readyWeekNumbers) === "[1,2,3]" &&
      JSON.stringify(aliceSplit.needsNote) === "[4]",
    `ready=${JSON.stringify(aliceSplit.readyWeekNumbers)} needsNote=${JSON.stringify(aliceSplit.needsNote)}`,
  );

  /* ====================================================================== */
  section("BOLUM 2 — HTTP YUZEYI");
  /* ====================================================================== */

  let serverUp = true;
  try {
    await fetch(`${BASE}/api/camps`);
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    skip("HTTP testleri", `${BASE} ayakta degil (npm run dev)`);
  } else {
    /* --- Oturumsuz --- */
    const anonGet = await fetch(`${BASE}/api/notes?camp=${camp.slug}`);
    check("oturumsuz GET -> 401", anonGet.status === 401, `status=${anonGet.status}`);

    const anonPost = await fetch(`${BASE}/api/notes`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({campSlug: camp.slug, weekNumber: 1, kind: "OZET"}),
    });
    check("oturumsuz POST -> 401", anonPost.status === 401, `status=${anonPost.status}`);

    const anonAdmin = await fetch(`${BASE}/api/admin/notes`);
    check(
      "oturumsuz yonetim ucu -> 401",
      anonAdmin.status === 401,
      `status=${anonAdmin.status}`,
    );

    /* --- Anvil test hesabiyla giris (ADMIN_ADDRESSES icinde) --- */
    const acct = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );
    let cookie = "";

    const nonceRes = await fetch(`${BASE}/api/auth/nonce`);
    const nonceCookie = nonceRes.headers.get("set-cookie");
    if (nonceCookie) cookie = nonceCookie.split(";")[0];
    const nonce = (await nonceRes.json()).data.nonce;

    const message = createSiweMessage({
      address: acct.address,
      chainId: 84532,
      domain: DOMAIN,
      nonce,
      uri: BASE,
      version: "1",
      issuedAt: new Date(),
    });
    const signature = await acct.signMessage({message});

    const verify = await fetch(`${BASE}/api/auth/verify`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Cookie: cookie},
      body: JSON.stringify({message, signature}),
    });
    const verifyCookie = verify.headers.get("set-cookie");
    if (verifyCookie) cookie = verifyCookie.split(";")[0];
    const verified = await verify.json();
    check("giris yapildi", verified.ok === true, verified.error);

    /* --- Not listesi --- */
    const listed = await (
      await fetch(`${BASE}/api/notes?camp=${camp.slug}`, {headers: {Cookie: cookie}})
    ).json();
    check("oturumla not listesi alindi", listed.ok === true, listed.error);

    /*
     * --- Nick kapisi ---
     *
     * NOT: Bu hesabin zincirde nicki YOK, bu yuzden POST her zaman nick
     * kapisinda durur ve icerik dogrulamasina HIC ULASILMAZ. Dolayisiyla
     * "kisa not sunucuda reddedilir" iddiasini buradan test EDEMEYIZ —
     * ettigimizi sansaydik test yanlis sebeple gecerdi.
     *
     * Icerik dogrulamasi Bolum 1c'de dogrudan `validateNote` uzerinden
     * test ediliyor; sunucunun cagirdigi fonksiyonun ta kendisi.
     */
    const noNick = await (
      await fetch(`${BASE}/api/notes`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Cookie: cookie},
        body: JSON.stringify({
          campSlug: camp.slug,
          weekNumber: 1,
          kind: "OZET",
          title: "Baslik burada",
          body: "cok kisa",
        }),
      })
    ).json();
    check(
      "nicki olmayan kullanici not birakamaz",
      noNick.ok === false && noNick.code === "NICKNAME_REQUIRED",
      `${noNick.code}: ${noNick.error}`,
    );

    /* --- /api/proofs: not borclu haftanin proof'u saklaniyor mu? --- */
    const proofs = await (
      await fetch(`${BASE}/api/proofs?camp=${camp.slug}`, {
        headers: {Cookie: cookie},
      })
    ).json();

    check("/api/proofs cevap verdi", proofs.ok === true, proofs.error);

    if (proofs.ok) {
      check(
        "/api/proofs artik 'needsNote' alanini donuyor",
        Array.isArray(proofs.data.needsNote),
      );

      const owedEntries = (proofs.data.weeks ?? []).filter(
        (w: {needsNote: boolean}) => w.needsNote,
      );

      if (owedEntries.length === 0) {
        skip(
          "not borclu haftanin proof'u saklaniyor",
          "bu hesapta zincire yazilmis + borclu hafta yok (durum olusmadi)",
        );
      } else {
        check(
          "not borclu haftalarin proof'u BOS",
          owedEntries.every(
            (w: {proof: string[]}) => w.proof.length === 0,
          ),
        );
        check(
          "not borclu haftalar claimBatch listesinde YOK",
          owedEntries.every(
            (w: {weekNumber: number}) =>
              !proofs.data.claimableWeekNumbers.includes(w.weekNumber),
          ),
        );
      }

      check(
        "claimable haftalarin proof'u dolu",
        (proofs.data.claimableProofs ?? []).every(
          (p: string[]) => Array.isArray(p) && p.length > 0,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    section("BOLUM 3 — HAFTALIK ILERLETME (/api/admin/completions)");
    /* ------------------------------------------------------------------ */

    const anonMark = await fetch(`${BASE}/api/admin/completions`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({campId: camp.id, weekNumber: 5, addresses: [ALICE]}),
    });
    check(
      "oturumsuz haftalik isaretleme -> 401",
      anonMark.status === 401,
      `status=${anonMark.status}`,
    );

    /* Alice su an: hak edilen 4, borc [4], gorunen 4 */
    const before = await getCampProgress(ALICE, camp.id, camp.weekCount);
    check(
      "on kosul: Alice 4. haftada, borcu [4]",
      before.entitledWeek === 4 && JSON.stringify(before.owedWeeks) === "[4]",
      `entitled=${before.entitledWeek} owed=${JSON.stringify(before.owedWeeks)}`,
    );

    const marked = await (
      await fetch(`${BASE}/api/admin/completions`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Cookie: cookie},
        body: JSON.stringify({
          campId: camp.id,
          weekNumber: 5,
          addresses: [ALICE],
        }),
      })
    ).json();
    check("yonetici 5. haftayi isaretledi", marked.ok === true, marked.error);
    check("1 kayit acildi", marked.ok && marked.data.created === 1);

    const after = await getCampProgress(ALICE, camp.id, camp.weekCount);
    check("hak edilen hafta 5 oldu", after.entitledWeek === 5);
    check(
      "borc [4, 5] oldu",
      JSON.stringify(after.owedWeeks) === "[4,5]",
      JSON.stringify(after.owedWeeks),
    );
    check(
      "5. hafta HALA KAPALI — 4'un notu yok",
      !canSeeWeek(after, 5),
      `visible=${after.visibleWeek}`,
    );

    /* 4. haftanin notunu yaz -> 5 acilmali */
    const gateNote = await db.weekNote.create({
      data: {
        campId: camp.id,
        weekNumber: 4,
        address: ALICE,
        authorNickname: "alice_test",
        kind: "TUZAK",
        title: "Nonce too low hatasi",
        body: BODY,
      },
    });

    const opened = await getCampProgress(ALICE, camp.id, camp.weekCount);
    check("4'un notu yazilinca 5. hafta ACILDI", canSeeWeek(opened, 5));
    check("4. hafta rozeti acildi", canClaimWeek(opened, 4));
    check("5. hafta rozeti hala kapali", !canClaimWeek(opened, 5));

    /* Geri alma */
    const removed = await (
      await fetch(`${BASE}/api/admin/completions`, {
        method: "DELETE",
        headers: {"Content-Type": "application/json", Cookie: cookie},
        body: JSON.stringify({
          campId: camp.id,
          weekNumber: 5,
          addresses: [ALICE],
        }),
      })
    ).json();
    check("isaret geri alindi", removed.ok === true, removed.error);

    const reverted = await getCampProgress(ALICE, camp.id, camp.weekCount);
    check("hak edilen hafta 4'e dondu", reverted.entitledWeek === 4);
    check("borc kalmadi (4'un notu yazilmisti)", reverted.owedWeeks.length === 0);
    check(
      "not tamamlaninca sonraki hafta icin 7 gunluk tahmin olustu",
      reverted.nextWeekAt?.getTime() ===
        gateNote.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000,
      `nextWeekAt=${reverted.nextWeekAt?.toISOString() ?? "null"}`,
    );

    /* Aynı notu sekiz gün önce atılmış hâle getir: yalnızca Alice ilerlemeli. */
    await db.weekNote.update({
      where: {id: gateNote.id},
      data: {createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)},
    });
    const personallyOpened = await getCampProgress(
      ALICE,
      camp.id,
      camp.weekCount,
    );
    check(
      "7 gun dolunca Alice'in 5. haftasi otomatik acildi",
      personallyOpened.entitledWeek === 5 && canSeeWeek(personallyOpened, 5),
      `entitled=${personallyOpened.entitledWeek} visible=${personallyOpened.visibleWeek}`,
    );

    const bobProgress = await getCampProgress(BOB, camp.id, camp.weekCount);
    check(
      "Alice'in suresi Bob'un ilerlemesini degistirmedi",
      bobProgress.entitledWeek === 0 && !canSeeWeek(bobProgress, 1),
      `bobEntitled=${bobProgress.entitledWeek}`,
    );

    /* Kamp hafta sayisinin disina isaretleme reddedilmeli */
    const outOfRange = await (
      await fetch(`${BASE}/api/admin/completions`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Cookie: cookie},
        body: JSON.stringify({
          campId: camp.id,
          weekNumber: camp.weekCount + 1,
          addresses: [ALICE],
        }),
      })
    ).json();
    check(
      "kamp disinda hafta reddedildi",
      outOfRange.ok === false && outOfRange.code === "WEEK_OUT_OF_RANGE",
      outOfRange.error,
    );
  }

  /* ====================================================================== */
  await cleanup();
  console.log("\n" + "=".repeat(64));
  console.log(
    fails === 0
      ? `TUM TESTLER GECTI${skipped ? ` (${skipped} atlandi)` : ""}`
      : `${fails} TEST BASARISIZ`,
  );
  process.exit(fails === 0 ? 0 : 1);
}

/** Testin yazdigi her seyi siler — mevcut veriye dokunmaz */
async function cleanup() {
  const addresses = [ALICE, BOB];
  await db.weekNote.deleteMany({where: {address: {in: addresses}}});
  await db.weeklyCompletion.deleteMany({where: {address: {in: addresses}}});
  await db.application.deleteMany({where: {address: {in: addresses}}});
}

main().catch(async (error) => {
  console.error("\nTEST CALISTIRILAMADI:", error);
  await cleanup().catch(() => {});
  process.exit(1);
});
