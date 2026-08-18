/**
 * ============================================================================
 * TAM UÇTAN UCA ENTEGRASYON TESTİ  (Faz 4)
 *
 * Önceki `e2e-backend.ts` zincire yazmadan duruyordu. Bu script zincirin
 * ucuna kadar gidiyor:
 *
 *   1. Başvuru kaydı            (veritabanı)
 *   2. Admin onayı              (API + SIWE oturumu)
 *   3. Merkle ağacı üretimi     (API)
 *   4. Kökün zincire yazılması  (cast, deploy cüzdanıyla)
 *   5. Rozetlerin alınması      (cast, katılımcı cüzdanıyla)
 *   6. Zincirden doğrulama      (balanceOf)
 *   7. Leaderboard'a yansıması  (API)
 *
 * NEDEN ÖNEMLİ: Her katman ayrı ayrı test edildi ve geçti. Ama katmanların
 * BİRLEŞİMİ hiç sınanmadı. En sinsi hatalar burada yaşar — örneğin admin
 * onayı doğru haftalar için kayıt açar, merkle ağacı doğru kurulur, ama
 * kullanıcı yanlış kamp kimliğiyle mint etmeye çalışır ve kimse sebebini
 * anlamaz.
 *
 * KATILIMCI: deploy cüzdanı (0x133a…). Gerçek Base Sepolia ETH'si var ve
 * zincirde nicki kayıtlı — yani gerçek bir kullanıcıyı temsil edebiliyor.
 * Directors kampında hiç rozeti yok, test için temiz bir alan.
 *
 * Kullanım:  npm run e2e:full
 * ============================================================================
 */
import {execFileSync} from "node:child_process";
import {homedir} from "node:os";
import {join} from "node:path";

import {privateKeyToAccount} from "viem/accounts";
import {createSiweMessage} from "viem/siwe";

import {db} from "../lib/db";
import {activeChain, contractAddress} from "../lib/chain/config";
import {readBalancesForPairs, readMerkleRoot} from "../lib/chain/client";
import {encodeTokenId} from "../lib/chain/tokenId";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
const RPC = "https://sepolia.base.org";

/** Katılımcı: deploy cüzdanı (keystore'da, gerçek ETH'si var) */
const PARTICIPANT = "0x133aa2E0709a4339FFFCb3ca1FAaBB5Fd26EC4aa";
const KEYSTORE_ACCOUNT = "pru-testnet";
const KEYSTORE_PASSWORD = "pru-testnet-2026";

/** Admin: Anvil hesap #0 — herkesçe bilinen test anahtarı */
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const admin = privateKeyToAccount(ADMIN_KEY);

/** Test alanı: Directors kampı (campId 2), 1-3. haftalar */
const CAMP_ID = 2;
const CAMP_SLUG = "directors";
const THROUGH_WEEK = 6;

let cookieJar = "";
let failures = 0;
let step = 0;

const CAST = join(homedir(), ".foundry", "bin", "cast.exe");

function heading(title: string): void {
  step += 1;
  console.log("");
  console.log("─".repeat(74));
  console.log(`  ${step}. ${title}`);
  console.log("─".repeat(74));
}

function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✔" : "✖"} ${label}${detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ok: boolean; data?: T; error?: string}> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar ? {Cookie: cookieJar} : {}),
      ...init.headers,
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookieJar = setCookie.split(";")[0];

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {ok: false, error: `JSON değil: ${text.slice(0, 160)}`};
  }
}

/**
 * `cast send` — deploy cüzdanının keystore'uyla imzalar.
 *
 * YENİDEN DENEME: Zincire yeni bir durum yazıldıktan hemen sonra gas
 * tahmini yapan RPC düğümü henüz güncellenmemiş olabilir ve "execution
 * reverted" döner — işlem aslında geçerlidir. Public RPC'ler birden çok
 * düğüm arkasında olduğu için bu durum sık görülüyor. Kısa bir bekleme
 * ile yeniden deneniyor.
 */
function castSendRaw(args: string[]): string {
  return execFileSync(
    CAST,
    [
      "send",
      contractAddress,
      ...args,
      "--rpc-url",
      RPC,
      "--account",
      KEYSTORE_ACCOUNT,
      "--password",
      KEYSTORE_PASSWORD,
    ],
    {encoding: "utf8", timeout: 180_000},
  );
}

function castSend(args: string[], retries = 3): string {
  for (let attempt = 0; ; attempt++) {
    try {
      return castSendRaw(args);
    } catch (error) {
      const message = String(error);
      const isLag =
        message.includes("estimate gas") || message.includes("execution reverted");
      if (!isLag || attempt >= retries) throw error;
      console.log(`     (RPC gecikmesi, ${(attempt + 1) * 5} sn sonra tekrar)`);
      execFileSync(
        process.execPath,
        ["-e", `setTimeout(()=>{}, ${(attempt + 1) * 5000})`],
        {timeout: (attempt + 1) * 6000},
      );
    }
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("═".repeat(74));
  console.log("  TAM UÇTAN UCA ENTEGRASYON TESTİ");
  console.log("═".repeat(74));
  console.log(`  Sunucu     : ${BASE_URL}`);
  console.log(`  Ağ         : ${activeChain.name}`);
  console.log(`  Kontrat    : ${contractAddress}`);
  console.log(`  Katılımcı  : ${PARTICIPANT}`);
  console.log(`  Test alanı : kamp ${CAMP_ID} (${CAMP_SLUG}), 1-${THROUGH_WEEK}. hafta`);

  /* ---- Temizlik: önceki test kalıntıları ---- */
  await db.application.deleteMany({
    where: {address: PARTICIPANT.toLowerCase(), campId: CAMP_ID},
  });
  await db.weeklyCompletion.deleteMany({
    where: {address: PARTICIPANT.toLowerCase(), campId: CAMP_ID},
  });

  /* ====================================================================== */
  heading("Başvuru kaydı");

  const application = await db.application.create({
    data: {
      address: PARTICIPANT.toLowerCase(),
      campId: CAMP_ID,
      declaredWeek: THROUGH_WEEK,
      nickname: "bugra",
      note: "Faz 4 uçtan uca test",
      status: "PENDING",
    },
  });
  check("başvuru oluşturuldu", Boolean(application.id));

  /* ====================================================================== */
  heading("Admin girişi (SIWE)");

  const nonceResponse = await api<{nonce: string}>("/api/auth/nonce");
  const nonce = nonceResponse.data?.nonce;
  check("nonce alındı", Boolean(nonce));

  const message = createSiweMessage({
    address: admin.address,
    chainId: activeChain.id,
    domain: new URL(BASE_URL).host,
    nonce: nonce!,
    uri: BASE_URL,
    version: "1",
    issuedAt: new Date(),
  });
  const signature = await admin.signMessage({message});

  const verify = await api<{address: string}>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({message, signature}),
  });
  check("imza doğrulandı", verify.ok, verify.error);

  const session = await api<{isAdmin: boolean}>("/api/auth/session");
  check("admin yetkisi var", session.data?.isAdmin === true);

  /* ====================================================================== */
  heading("Admin onayı");

  const approval = await api<{completionsCreated: number}>(
    "/api/admin/applications",
    {
      method: "PATCH",
      body: JSON.stringify({
        applicationId: application.id,
        action: "approve",
        reviewNote: "Faz 4 testi",
      }),
    },
  );
  check("onay işlendi", approval.ok, approval.error);
  check(
    `1..${THROUGH_WEEK} için kayıt açıldı`,
    (approval.data?.completionsCreated ?? 0) > 0,
    `oluşan: ${approval.data?.completionsCreated}`,
  );

  /* ====================================================================== */
  heading("Merkle ağacı üretimi");

  const merkle = await api<{
    trees: {weekNumber: number; root: string; entryCount: number}[];
    needsPublishing: number;
  }>("/api/admin/merkle", {
    method: "POST",
    body: JSON.stringify({
      campSlug: CAMP_SLUG,
      weeks: [1, 2, 3, 4, 5, 6],
    }),
  });
  check("ağaçlar üretildi", merkle.ok, merkle.error);

  const trees = merkle.data?.trees ?? [];
  check(`${THROUGH_WEEK} hafta için ağaç var`, trees.length === THROUGH_WEEK, `bulunan: ${trees.length}`);
  for (const tree of trees) {
    console.log(
      `     hafta ${tree.weekNumber}: ${tree.entryCount} kişi, kök ${tree.root.slice(0, 16)}…`,
    );
  }

  /* ====================================================================== */
  heading("Köklerin zincire yazılması (deploy cüzdanı)");

  /*
   * TEK İŞLEMDE üç kök: `setMerkleRoots` toplu fonksiyonu.
   *
   * İlk denemede üç ayrı `cast send` gönderilmişti ve "nonce too low"
   * hatası alındı — art arda gönderilen işlemlerde RPC'nin bekleyen nonce
   * takibi yetişemiyor. Toplu fonksiyon bu yarışı tamamen ortadan kaldırıyor
   * ve haftalık akışta da zaten kullanılacak olan yol bu.
   */
  const weekList = trees.map((t) => t.weekNumber);
  const rootList = trees.map((t) => t.root);

  try {
    const output = castSend([
      "setMerkleRoots(uint256,uint256[],bytes32[])",
      String(CAMP_ID),
      `[${weekList.join(",")}]`,
      `[${rootList.join(",")}]`,
    ]);
    check("setMerkleRoots işlemi gönderildi", output.includes("status"));
    const gasLine = output.split("\n").find((l) => l.includes("gasUsed"));
    if (gasLine) console.log(`     ${gasLine.trim()}`);
  } catch (error) {
    check("setMerkleRoots işlemi gönderildi", false, String(error).slice(0, 300));
  }

  /*
   * Zincir okuması için BEKLE.
   *
   * `cast send` makbuzu beklese bile, okuduğumuz RPC düğümü aynı anda
   * güncellenmiş olmayabilir (public RPC'ler birden çok düğüm arkasında).
   * İlk denemede kökler 0x00 okunmuştu; birkaç saniye sonra doğruydu.
   * Bu yüzden eşleşene kadar yoklama yapıyoruz.
   */
  for (const tree of trees) {
    let onChain = "0x0" as `0x${string}`;
    let matched = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      onChain = await readMerkleRoot(CAMP_ID, tree.weekNumber).catch(
        () => "0x0" as `0x${string}`,
      );
      if (onChain.toLowerCase() === tree.root.toLowerCase()) {
        matched = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    check(
      `hafta ${tree.weekNumber} kökü zincirde doğrulandı`,
      matched,
      matched ? "" : `zincir: ${onChain}\n      beklenen: ${tree.root}`,
    );
  }

  /* ====================================================================== */
  heading("Proof dağıtımı (kullanıcı görüşü)");

  /*
   * Proof'ları doğrudan servis katmanından alıyoruz. API üzerinden almak
   * için katılımcının SIWE oturumu gerekirdi; onun anahtarı bu script'te
   * yok (ve olmamalı — keystore'da şifreli duruyor).
   */
  const {getProofsForAddress} = await import("../lib/merkle/service");
  const bundle = await getProofsForAddress(PARTICIPANT, CAMP_ID);

  check(
    `${THROUGH_WEEK} hafta için proof hazır ve kökü yayınlanmış`,
    bundle.claimable.length === THROUGH_WEEK,
    `claimable: ${bundle.claimable.length}, pending: ${bundle.pendingPublication.length}`,
  );

  /* ====================================================================== */
  heading("Rozetlerin alınması (katılımcı cüzdanı)");

  /* Zaten alınmış rozetler için tekrar mint denemek AlreadyClaimed ile
     reverte düşer. Yalnızca eksik olanları alıyoruz. */
  const ownedNow = await readBalancesForPairs(
    bundle.claimable.map((c) => ({
      address: PARTICIPANT as `0x${string}`,
      tokenId: encodeTokenId(CAMP_ID, c.weekNumber),
    })),
  );
  const toClaim = bundle.claimable.filter((_, i) => !ownedNow[i]);

  const weeks = toClaim.map((c) => c.weekNumber);
  const proofs = toClaim.map((c) => c.proof);
  console.log(`     alınacak hafta: ${weeks.join(", ") || "(hepsi zaten alınmış)"}`);

  if (weeks.length > 0) {
    const weeksArg = `[${weeks.join(",")}]`;
    const proofsArg = `[${proofs.map((p) => `[${p.join(",")}]`).join(",")}]`;

    try {
      const output = castSend([
        "claimBatch(uint256,uint256[],bytes32[][])",
        String(CAMP_ID),
        weeksArg,
        proofsArg,
      ]);
      const success = output.includes("status") && output.includes("1 (success)");
      check("claimBatch işlemi başarılı", success);

      const gasLine = output.split("\n").find((l) => l.includes("gasUsed"));
      if (gasLine) console.log(`     ${gasLine.trim()}`);
    } catch (error) {
      check("claimBatch işlemi başarılı", false, String(error).slice(0, 300));
    }
  } else {
    check("tüm rozetler zaten alınmış (atlandı)", true);
  }

  /* ====================================================================== */
  heading("Zincirden doğrulama");

  const allWeeks = Array.from({length: THROUGH_WEEK}, (_, i) => i + 1);
  const pairs = allWeeks.map((week) => ({
    address: PARTICIPANT as `0x${string}`,
    tokenId: encodeTokenId(CAMP_ID, week),
  }));

  /*
   * Zincir okumasını YOKLA.
   *
   * Mint işleminin makbuzu alındıktan hemen sonra okunan RPC düğümü henüz
   * güncellenmemiş olabilir. Bu testte tam olarak bu yaşandı: 8. adım
   * rozetleri göremedi ama saniyeler sonra çalışan 9. adım (aynı zincir
   * okumasıyla) 6/6 gösterdi. Okuma hatası, mint hatası değil.
   */
  let balances: boolean[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    balances = await readBalancesForPairs(pairs);
    if (balances.every(Boolean)) break;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  for (const week of allWeeks) {
    check(`hafta ${week} rozeti cüzdanda`, balances[week - 1] === true);
  }

  /* ====================================================================== */
  heading("Leaderboard'a yansıması");

  const leaderboard = await api<{
    rows: {address: string; nickname: string; campSlug: string; completedWeeks: number}[];
  }>("/api/leaderboard");

  const row = leaderboard.data?.rows.find(
    (r) =>
      r.address.toLowerCase() === PARTICIPANT.toLowerCase() &&
      r.campSlug === CAMP_SLUG,
  );

  check("katılımcı sıralamada görünüyor", Boolean(row), `satır sayısı: ${leaderboard.data?.rows.length}`);
  if (row) {
    check(`${THROUGH_WEEK} hafta tamamlanmış görünüyor`, row.completedWeeks === THROUGH_WEEK, `görünen: ${row.completedWeeks}`);
    check("nick zincirden okundu", row.nickname.length > 0, `nick: "${row.nickname}"`);
  }

  /* ====================================================================== */
  console.log("");
  console.log("═".repeat(74));
  if (failures === 0) {
    console.log("  ✅ TAM ZİNCİR ÇALIŞIYOR");
    console.log("     Başvuru → onay → merkle → zincir → rozet → sıralama");
  } else {
    console.log(`  ❌ ${failures} ADIM BAŞARISIZ`);
  }
  console.log("═".repeat(74));
  console.log("");

  await db.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\n✖ Test çalıştırılamadı:\n", error);
  await db.$disconnect();
  process.exit(1);
});
