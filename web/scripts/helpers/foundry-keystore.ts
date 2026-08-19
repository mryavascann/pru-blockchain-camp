import {execFileSync} from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {join} from "node:path";

import {isAddress, type Address, type Hash} from "viem";

const CAST = join(
  homedir(),
  ".foundry",
  "bin",
  process.platform === "win32" ? "cast.exe" : "cast",
);

export type FoundryKeystore = {
  accountName: string;
  address: Address;
  run: (args: string[], timeout?: number) => string;
  signMessage: (message: string) => Hash;
};

/**
 * E2E işlemlerini Foundry'nin şifreli keystore'u ile imzalar.
 *
 * Parola `--password` ile süreç listesine yazılmaz. Foundry'nin beklediği
 * parola dosyası işletim sisteminin geçici klasöründe yalnızca çağrı boyunca
 * oluşturulur ve `finally` içinde silinir. Böylece testler düz private key
 * istemeden hem SIWE mesajı hem de Base Sepolia işlemi imzalayabilir.
 */
export function loadFoundryKeystore(): FoundryKeystore {
  const accountName = process.env.E2E_KEYSTORE_ACCOUNT ?? "pru-testnet";
  const password = process.env.E2E_KEYSTORE_PASSWORD ?? "";

  if (!existsSync(CAST)) {
    throw new Error(`Foundry cast bulunamadı: ${CAST}`);
  }
  if (!password) {
    throw new Error(
      "E2E_KEYSTORE_PASSWORD eksik. Değeri yalnızca web/.env.local içinde tanımla.",
    );
  }

  const run = (args: string[], timeout = 180_000): string => {
    const passwordDir = mkdtempSync(join(tmpdir(), "pru-keystore-"));
    const passwordFile = join(passwordDir, "password.txt");
    writeFileSync(passwordFile, password, {encoding: "utf8", mode: 0o600});

    try {
      return execFileSync(
        CAST,
        [
          ...args,
          "--account",
          accountName,
          "--password-file",
          passwordFile,
          "--color",
          "never",
        ],
        {
          encoding: "utf8",
          timeout,
          windowsHide: true,
        },
      ).trim();
    } finally {
      rmSync(passwordDir, {force: true, recursive: true});
    }
  };

  const rawAddress = run(["wallet", "address"]);
  if (!isAddress(rawAddress)) {
    throw new Error(`Keystore geçerli bir EVM adresi döndürmedi: ${rawAddress}`);
  }
  const address = rawAddress as Address;

  return {
    accountName,
    address,
    run,
    signMessage(message: string): Hash {
      const signature = run(["wallet", "sign", message]);
      if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
        throw new Error("Keystore geçerli bir EVM imzası döndürmedi.");
      }
      return signature as Hash;
    },
  };
}
