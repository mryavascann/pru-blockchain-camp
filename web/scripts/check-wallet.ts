/**
 * ============================================================================
 * CÜZDAN DURUMU — "işlem geçti mi geçmedi mi?" sorusunun cevabı
 *
 * NEDEN BU SCRIPT VAR:
 *
 * MetaMask bir işlemi gönderdikten sonra durumu KENDİ RPC'sinden okur. O RPC
 * cevap vermezse ("ağa bağlanılamıyor") cüzdan işlemin akıbetini bilemez ve
 * kullanıcı da bilemez — işlem zincire yazılmış olsa bile ekranda "bekliyor"
 * görünür ya da hiç görünmez.
 *
 * Bu script cüzdana hiç güvenmeden, doğrudan zincire sorar. Cevabı MetaMask'in
 * ağ durumundan bağımsızdır.
 *
 * ---------------------------------------------------------------------------
 * KULLANIM
 *
 *   npm run check:wallet -- 0xCüzdanAdresin
 *
 * Cevapladığı sorular:
 *   • Zincir ve RPC gerçekten erişilebilir mi? (blok numarası)
 *   • Bu adresin kaç işlemi ONAYLANMIŞ, kaç tanesi mempool'da BEKLİYOR?
 *     İkisi arasındaki fark = sırayı tıkayan işlem sayısı.
 *   • Nick zincire yazıldı mı? (`nicknameOf`)
 *   • Yazılmadıysa, denenen nick başkası tarafından alınmış mı?
 * ============================================================================
 */
// Not: Ortam değişkenleri `tsx --env-file=.env.local` ile YÜKLENİR
// (bkz. package.json → check:wallet).
import {createPublicClient, formatEther, getAddress, isAddress} from "viem";

import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {
  activeChain,
  contractAddress,
  explorerUrl,
  rpcUrls,
} from "@/lib/chain/config";
import {createReadTransport} from "@/lib/chain/transport";

const [rawAddress, triedNickname] = process.argv.slice(2);

if (!rawAddress || !isAddress(rawAddress)) {
  console.error("Kullanım: npm run check:wallet -- 0xAdres [denenenNick]");
  process.exit(1);
}

const address = getAddress(rawAddress);

/*
 * Sunucunun kullandığı taşıyıcının AYNISI: `RPC_URL` varsa önce o, sonra
 * havuzdaki diğer adresler. Script'in "çalışıyor" demesi, uygulamanın da
 * çalışacağı anlamına gelsin diye aynı yolu kullanıyoruz.
 */
const preferred = process.env.RPC_URL || undefined;
const client = createPublicClient({
  chain: activeChain,
  transport: createReadTransport(preferred),
});

async function main() {
  const block = await client.getBlockNumber();
  console.log(`Ağ         : ${activeChain.name} (chainId ${activeChain.id})`);
  console.log(
    `RPC sırası : ${[preferred, ...rpcUrls.filter((u) => u !== preferred)]
      .filter(Boolean)
      .join(" → ")}`,
  );
  console.log(`Son blok   : ${block}`);
  console.log(`Adres      : ${address}`);

  const balance = await client.getBalance({address});
  console.log(`Bakiye     : ${formatEther(balance)} ETH`);

  /*
   * "latest" = zincire yazılmış işlem sayısı.
   * "pending" = mempool'daki bekleyenler dahil.
   * Aradaki fark, sırayı tıkayan işlem sayısıdır.
   */
  const confirmed = await client.getTransactionCount({address, blockTag: "latest"});
  const pending = await client.getTransactionCount({address, blockTag: "pending"});

  console.log(`Onaylanmış : ${confirmed} işlem (sıradaki nonce: ${confirmed})`);
  console.log(`Bekleyen   : ${pending - confirmed} işlem`);

  if (pending > confirmed) {
    console.log(
      `\n⚠ Sıra TIKALI. ${confirmed} numaralı nonce onaylanmadan sonrakiler ` +
        `işlenemez.\n  MetaMask → Etkinlik → bekleyen işlem → "Hızlandır" ya da "İptal Et".`,
    );
  }

  /* ---- Nick zincire yazıldı mı? ---- */
  const nickname = (await client.readContract({
    address: contractAddress,
    abi: pruCampBadgesAbi,
    functionName: "nicknameOf",
    args: [address],
  })) as string;

  console.log(
    nickname
      ? `\n✓ NICK ZİNCİRDE: "${nickname}" — işlem geçmiş, tekrar göndermene gerek yok.`
      : "\n✗ Bu adrese kayıtlı nick YOK — işlem zincire yazılmamış.",
  );

  /* ---- Denenen nick başkasında mı? ---- */
  if (!nickname && triedNickname) {
    const owner = (await client.readContract({
      address: contractAddress,
      abi: pruCampBadgesAbi,
      functionName: "ownerOfNickname",
      args: [triedNickname],
    })) as string;

    const taken = owner !== "0x0000000000000000000000000000000000000000";
    console.log(
      taken
        ? `  "${triedNickname}" başkası tarafından alınmış (${owner}).`
        : `  "${triedNickname}" hâlâ boşta — tekrar deneyebilirsin.`,
    );
  }

  console.log(`\nGezgin     : ${explorerUrl}/address/${address}`);
}

main().catch((error) => {
  console.error("Zincire ulaşılamadı:", error instanceof Error ? error.message : error);
  process.exit(1);
});
