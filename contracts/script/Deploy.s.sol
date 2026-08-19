// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {PruCampBadges} from "../src/PruCampBadges.sol";

/// @title Deploy — PruCampBadges'i UUPS proxy arkasında kurar
///
/// @notice Kullanım (Base Sepolia):
///
///     forge script script/Deploy.s.sol:Deploy \
///       --rpc-url base_sepolia \
///       --account pru-deployer \
///       --broadcast \
///       --verify \
///       -vvvv
///
/// @dev İMZALAYICI SCRIPT'TE TUTULMAZ.
///      `vm.startBroadcast()` argümansız çağrılır; imzalayan cüzdan komut
///      satırından verilir. Önerilen yol şifreli keystore'dur:
///
///          cast wallet import pru-deployer --interactive
///
///      Bu, private key'i şifreli olarak ~/.foundry/keystores altına kaydeder
///      ve her kullanımda parola sorar. Böylece key ne `.env` dosyasında ne
///      de kabuk geçmişinde düz metin olarak durur.
///
///      Daha az güvenli alternatif: `--private-key $PRIVATE_KEY`
///
/// @dev NE DEPLOY EDİLİYOR — İKİ KONTRAT:
///
///        1. Implementation : Mantık burada. Kimse doğrudan konuşmaz.
///        2. Proxy          : Kalıcı adres. Tüm rozetler ve veriler burada.
///                            Kullanıcılar, frontend, OpenSea → hep bu adres.
///
///      Upgrade yapıldığında YALNIZCA implementation değişir. Proxy adresi ve
///      içindeki her şey aynı kalır. Bu yüzden kaydedip her yerde kullanacağın
///      adres PROXY adresidir.
contract Deploy is Script {
    function run() external returns (address proxyAddress, address implementationAddress) {
        // ---- Yapılandırma (.env dosyasından okunur) ----
        address initialOwner = vm.envAddress("OWNER_ADDRESS");
        string memory baseURI = vm.envString("BASE_URI");
        string memory contractURI = vm.envString("CONTRACT_URI");

        require(initialOwner != address(0), "OWNER_ADDRESS bos");
        require(bytes(baseURI).length > 0, "BASE_URI bos");

        vm.startBroadcast();

        // 1) Mantık kontratı
        PruCampBadges implementation = new PruCampBadges();

        // 2) Proxy — kurulum çağrısı deploy ile AYNI işlemde yapılır.
        //    Bu önemli: ayrı işlemler olsaydı arada bir saldırgan proxy'yi
        //    kendi adına initialize edebilirdi (front-running).
        bytes memory initData =
            abi.encodeCall(PruCampBadges.initialize, (initialOwner, baseURI, contractURI));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        vm.stopBroadcast();

        proxyAddress = address(proxy);
        implementationAddress = address(implementation);

        // ---- Özet ----
        console.log("");
        console.log("==========================================================");
        console.log("  PRU Blockchain Kulubu - Kamp Rozetleri deploy edildi");
        console.log("==========================================================");
        console.log("  Zincir ID          :", block.chainid);
        console.log("  PROXY (bunu kaydet):", proxyAddress);
        console.log("  Implementation     :", implementationAddress);
        console.log("  Sahip (owner)      :", initialOwner);
        console.log("  Base URI           :", baseURI);
        console.log("==========================================================");
        console.log("");
        console.log("  SONRAKI ADIM: .env dosyasina yaz ->");
        console.log("  PROXY_ADDRESS=", proxyAddress);
        console.log("");
        console.log("  Ardindan kamplari olustur (docs/deploy.md, adim 6).");
        console.log("");
    }
}
