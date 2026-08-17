/**
 * ============================================================================
 * Merkle format çapraz doğrulaması — TypeScript ↔ Solidity
 *
 * NEDEN BU SCRIPT VAR:
 *
 * Merkle ağacı İKİ AYRI YERDE, İKİ AYRI DİLDE uygulanıyor:
 *   • Backend (TypeScript)  → ağacı kurar, proof üretir
 *   • Kontrat (Solidity)    → proof'u doğrular
 *
 * Bu ikisi arasında en ufak bir fark — farklı hash sırası, tek hash yerine
 * çift hash, farklı abi kodlaması — şu sonuca yol açar: backend geçerli
 * görünen bir proof üretir, kullanıcı "Rozeti Al"a basar, cüzdanı onaylar,
 * gas öder ve işlem `InvalidMerkleProof` ile geri döner.
 *
 * Bu hata TİPİK OLARAK ÜRETİMDE, İLK GERÇEK KULLANICIDA ortaya çıkar —
 * çünkü iki taraf ayrı ayrı test edildiğinde ikisi de "çalışıyor" görünür.
 *
 * Bu script iki tarafı BİRBİRİNE KARŞI test eder ve varsayımı ortadan kaldırır.
 *
 * ---------------------------------------------------------------------------
 * KULLANIM
 *
 *   1) npm run verify:merkle
 *      → Yaprak formatını doğrular. Kök karşılaştırması için gereken
 *        `cast send` komutunu ekrana yazar.
 *
 *   2) Ekrandaki komutu çalıştır (kökü zincire yazar, ~30k gas)
 *
 *   3) npm run verify:merkle
 *      → Bu kez tam doğrulama yapar: kök eşleşmesi + her proof'un zincirde
 *        geçerli sayılması.
 * ============================================================================
 */
// Not: Ortam değişkenleri `tsx --env-file=.env.local` ile YÜKLENİR
// (bkz. package.json → verify:merkle).
//
// Burada `dotenv.config()` çağırmak İŞE YARAMAZ: ESM `import` ifadeleri
// hoisting nedeniyle dosyadaki her ifadeden önce çalışır, dolayısıyla
// aşağıdaki modüller ortam değişkenlerini config() koşmadan okur.
import {getAddress} from "viem";
import type {Address} from "viem";

import {buildMerkleTree, getProofFromDump, computeLeaf} from "../lib/merkle/tree";
import {
  readMerkleLeaf,
  readMerkleRoot,
  readIsProofValid,
} from "../lib/chain/client";
import {contractAddress, activeChain} from "../lib/chain/config";

/** Doğrulama için kullanılacak sahte katılımcı listesi (deterministik) */
const TEST_ADDRESSES: Address[] = [
  "0x133aa2E0709a4339FFFCb3ca1FAaBB5Fd26EC4aa",
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
];

/** Doğrulamanın yapılacağı (kamp, hafta). Gerçek veriyi bozmamak için
 *  Directors kampının kullanılmayan bir haftası seçildi. */
const TEST_CAMP = 2;
const TEST_WEEK = 12;

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ✔ ${label}`);
  } else {
    console.log(`  ✖ ${label}${detail ? `\n      ${detail}` : ""}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("═".repeat(72));
  console.log("  Merkle format doğrulaması — TypeScript ↔ Solidity");
  console.log("═".repeat(72));
  console.log(`  Ağ      : ${activeChain.name} (${activeChain.id})`);
  console.log(`  Kontrat : ${contractAddress}`);
  console.log("");

  /* ---------------------------------------------------------------------- */
  /* 1. YAPRAK FORMATI                                                       */
  /*    En temel katman: tek bir yaprağın hash'i iki tarafta aynı mı?        */
  /* ---------------------------------------------------------------------- */
  console.log("① Yaprak (leaf) formatı");

  const leafCases: [Address, number, number][] = [
    [TEST_ADDRESSES[0], 1, 1],
    [TEST_ADDRESSES[0], 1, 3],
    [TEST_ADDRESSES[1], 2, 12],
    [TEST_ADDRESSES[2], 1, 15],
  ];

  for (const [address, campId, week] of leafCases) {
    const local = computeLeaf(address, campId, week);
    const onChain = await readMerkleLeaf(address, campId, week);
    check(
      `kamp ${campId} hafta ${week} → ${local.slice(0, 12)}…`,
      local.toLowerCase() === onChain.toLowerCase(),
      `TS      : ${local}\n      Kontrat : ${onChain}`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 2. AĞAÇ KURULUMU                                                        */
  /*    5 kişilik bir ağacın kökü, kontrata yazılanla eşleşiyor mu?          */
  /* ---------------------------------------------------------------------- */
  console.log("");
  console.log("② Ağaç kurulumu ve kök");

  const tree = buildMerkleTree(TEST_CAMP, TEST_WEEK, TEST_ADDRESSES);
  const onChainRoot = await readMerkleRoot(TEST_CAMP, TEST_WEEK);
  const rootIsSet =
    onChainRoot !==
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log(`  TS kökü      : ${tree.root}`);
  console.log(`  Zincir kökü  : ${rootIsSet ? onChainRoot : "(henüz yazılmadı)"}`);
  console.log(`  Yaprak sayısı: ${tree.entryCount}`);

  if (!rootIsSet) {
    console.log("");
    console.log("─".repeat(72));
    console.log("  ⚠ Kök henüz zincire yazılmamış — tam doğrulama yapılamıyor.");
    console.log("");
    console.log("  Şu komutu çalıştır, sonra bu script'i tekrar koş:");
    console.log("");
    console.log(`    cd ../contracts && cast send ${contractAddress} \\`);
    console.log(`      "setMerkleRoot(uint256,uint256,bytes32)" \\`);
    console.log(`      ${TEST_CAMP} ${TEST_WEEK} ${tree.root} \\`);
    console.log(`      --rpc-url https://sepolia.base.org \\`);
    console.log(`      --account pru-testnet`);
    console.log("");
    console.log("─".repeat(72));
    console.log("");
    process.exit(failures > 0 ? 1 : 0);
  }

  check(
    "kök eşleşmesi",
    tree.root.toLowerCase() === onChainRoot.toLowerCase(),
    `TS      : ${tree.root}\n      Zincir  : ${onChainRoot}`,
  );

  /* ---------------------------------------------------------------------- */
  /* 3. PROOF DOĞRULAMASI                                                    */
  /*    En güçlü test: TS'in ürettiği proof'u kontrat kabul ediyor mu?       */
  /* ---------------------------------------------------------------------- */
  console.log("");
  console.log("③ Proof doğrulaması (kontratın kendi doğrulayıcısıyla)");

  for (const address of TEST_ADDRESSES) {
    const proof = getProofFromDump(tree.dump, address, TEST_CAMP, TEST_WEEK);

    if (!proof) {
      check(`${address.slice(0, 10)}… proof üretimi`, false, "proof bulunamadı");
      continue;
    }

    const valid = await readIsProofValid(address, TEST_CAMP, TEST_WEEK, proof);
    check(
      `${address.slice(0, 10)}… → ${proof.length} adımlı proof kabul edildi`,
      valid,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 4. NEGATİF TEST                                                         */
  /*    Listede olmayan bir adres reddedilmeli.                              */
  /* ---------------------------------------------------------------------- */
  console.log("");
  console.log("④ Negatif test (listede olmayan adres reddedilmeli)");

  const outsider = getAddress("0x9999999999999999999999999999999999999999");
  const stolenProof = getProofFromDump(
    tree.dump,
    TEST_ADDRESSES[0],
    TEST_CAMP,
    TEST_WEEK,
  );

  const outsiderValid = await readIsProofValid(
    outsider,
    TEST_CAMP,
    TEST_WEEK,
    stolenProof ?? [],
  );
  check("başkasının proof'u ile giriş reddedildi", !outsiderValid);

  const wrongWeekValid = await readIsProofValid(
    TEST_ADDRESSES[0],
    TEST_CAMP,
    1,
    stolenProof ?? [],
  );
  check("başka haftanın proof'u reddedildi", !wrongWeekValid);

  /* ---------------------------------------------------------------------- */
  console.log("");
  console.log("═".repeat(72));
  if (failures === 0) {
    console.log("  ✅ TÜM DOĞRULAMALAR GEÇTİ");
    console.log("     Backend'in ürettiği proof'ları kontrat kabul ediyor.");
  } else {
    console.log(`  ❌ ${failures} DOĞRULAMA BAŞARISIZ`);
    console.log("     Backend ile kontrat arasında uyumsuzluk var — DEPLOY ETME.");
  }
  console.log("═".repeat(72));
  console.log("");

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\n✖ Doğrulama çalıştırılamadı:\n", error);
  process.exit(1);
});
