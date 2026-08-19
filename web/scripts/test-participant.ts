import {generatePrivateKey, privateKeyToAccount} from "viem/accounts";
import {createSiweMessage} from "viem/siwe";
import {db} from "../lib/db";

const BASE = "http://localhost:3100";
const acct = privateKeyToAccount(generatePrivateKey());
let cookie = "";
let fails = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "OK " : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
  if (!ok) fails += 1;
}

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? {Cookie: cookie} : {}),
      ...(init.headers ?? {}),
    },
  });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await r.text();
  try {
    return {status: r.status, body: JSON.parse(text)};
  } catch {
    return {status: r.status, body: {ok: false, error: text.slice(0, 120)}};
  }
}

async function main() {
  console.log("\nKATILIMCI PROFILI — UCTAN UCA TEST");
  console.log("=".repeat(60));

  await db.participant.deleteMany({where: {address: acct.address.toLowerCase()}});

  /* --- Giris --- */
  const nonce = (await api("/api/auth/nonce")).body.data.nonce;
  const message = createSiweMessage({
    address: acct.address,
    chainId: 84532,
    domain: "localhost:3100",
    nonce,
    uri: BASE,
    version: "1",
    issuedAt: new Date(),
  });
  const signature = await acct.signMessage({message});
  const v = await api("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({message, signature}),
  });
  check("giris yapildi", v.body.ok, v.body.error);

  /* --- Bos profil --- */
  const empty = await api("/api/participant");
  check(
    "yeni kullanici -> bos profil",
    empty.body.ok && empty.body.data.profile.university === null,
  );

  /* --- Dogrulama: eksik alan --- */
  const bad = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({university: "Piri Reis Universitesi"}),
  });
  check("eksik alan reddedildi", !bad.body.ok, bad.body.error);

  /* --- Dogrulama: 'Diger' secildi ama aciklama yok --- */
  const noDetail = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({
      university: "Piri Reis Universitesi",
      referralSource: "other",
    }),
  });
  check("'Diger' aciklamasiz reddedildi", !noDetail.body.ok, noDetail.body.error);

  /* --- Dogrulama: gecersiz kaynak --- */
  const badSource = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({
      university: "Piri Reis Universitesi",
      referralSource: "tiktok",
    }),
  });
  check("liste disi secenek reddedildi", !badSource.body.ok);

  /* --- Gecerli kayit --- */
  const good = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({
      university: "Piri Reis Universitesi",
      referralSource: "club_event",
    }),
  });
  check("gecerli profil kaydedildi", good.body.ok, good.body.error);
  check(
    "universite dogru dondu",
    good.body.data?.profile.university === "Piri Reis Universitesi",
  );

  /* --- Tekrar okuma --- */
  const again = await api("/api/participant");
  check(
    "kalici (GET ile geri okundu)",
    again.body.data?.profile.referralSource === "club_event",
  );

  /* --- Guncelleme + 'Diger' ile detay --- */
  const upd = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({
      university: "Istanbul Teknik Universitesi",
      referralSource: "other",
      referralDetail: "bolum hocamiz derste bahsetti",
    }),
  });
  check("guncelleme calisti", upd.body.ok, upd.body.error);
  check(
    "detay saklandi",
    upd.body.data?.profile.referralDetail === "bolum hocamiz derste bahsetti",
  );

  /* --- 'Diger' disina donunce detay temizleniyor mu --- */
  const back = await api("/api/participant", {
    method: "PUT",
    body: JSON.stringify({
      university: "Piri Reis Universitesi",
      referralSource: "instagram",
      referralDetail: "arta kalan metin",
    }),
  });
  check(
    "'Diger' disinda detay temizlendi",
    back.body.data?.profile.referralDetail === null,
    String(back.body.data?.profile.referralDetail),
  );

  /* --- Oturumsuz erisim --- */
  const savedCookie = cookie;
  cookie = "";
  const anon = await api("/api/participant");
  check("oturumsuz istek reddedildi", anon.status === 401, `HTTP ${anon.status}`);
  cookie = savedCookie;

  await db.participant.deleteMany({where: {address: acct.address.toLowerCase()}});

  console.log("=".repeat(60));
  console.log(fails === 0 ? "  TUM TESTLER GECTI" : `  ${fails} TEST BASARISIZ`);
  await db.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
