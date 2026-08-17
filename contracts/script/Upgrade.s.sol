// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {PruCampBadges} from "../src/PruCampBadges.sol";

/// @title Upgrade — Kontrat mantığını günceller
///
/// @notice Kullanım:
///
///     forge script script/Upgrade.s.sol:Upgrade \
///       --rpc-url base_sepolia \
///       --account pru-deployer \
///       --broadcast \
///       --verify
///
/// @dev ⚠️  UPGRADE ÖNCESİ ZORUNLU KONTROL LİSTESİ
///
///      1. Yeni sürüm `UUPSUpgradeable`'ı MİRAS ALIYOR MU?
///         Almazsa `_authorizeUpgrade` kaybolur ve kontrat SONSUZA KADAR
///         kilitlenir — bir daha asla upgrade yapılamaz. UUPS'in tek gerçek
///         tuzağı budur.
///
///      2. DEPOLAMA DÜZENİ KORUNUYOR MU?
///         Mevcut değişkenlerin sırası, tipi değişmemeli; araya yeni değişken
///         eklenmemeli. Yeni değişkenler yalnızca SONA eklenir ve ilgili
///         modülün `__gap` dizisi o kadar azaltılır.
///
///      3. TESTLER GEÇİYOR MU?  `forge test` yeşil olmalı.
///
///      4. TESTNET'TE DENENDİ Mİ?
///         Mainnet upgrade'i asla ilk deneme olmamalı. Önce Base Sepolia'da
///         aynı upgrade yapılıp `test_Upgrade_PreservesAllState` senaryosu
///         gerçek zincirde doğrulanmalı.
///
///      5. `version()` ARTIRILDI MI?
///         Upgrade sonrası doğru sürümün aktif olduğunu bu fonksiyon söyler.
contract Upgrade is Script {
    function run() external returns (address newImplementation) {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        require(proxyAddress != address(0), "PROXY_ADDRESS bos");

        PruCampBadges badges = PruCampBadges(proxyAddress);

        string memory versionBefore = badges.version();
        address ownerBefore = badges.owner();
        uint256 campCountBefore = badges.campCount();

        vm.startBroadcast();

        // Yeni mantık kontratını deploy et
        PruCampBadges implementation = new PruCampBadges();

        // Proxy'yi yeni mantığa yönlendir.
        // İkinci parametre boş: kurulum çağrısı gerekmiyor. Yeni sürüm bir
        // "reinitializer" gerektiriyorsa buraya abi.encodeCall(...) konur.
        badges.upgradeToAndCall(address(implementation), "");

        vm.stopBroadcast();

        newImplementation = address(implementation);

        // ---- Upgrade sonrası akıl sağlığı kontrolü ----
        require(badges.owner() == ownerBefore, "SAHIP DEGISTI - DURUM BOZULDU");
        require(badges.campCount() == campCountBefore, "KAMP SAYISI DEGISTI - DURUM BOZULDU");

        console.log("");
        console.log("=== Upgrade tamamlandi ===");
        console.log("  Proxy (degismedi) :", proxyAddress);
        console.log("  Yeni implementation:", newImplementation);
        console.log("  Surum: %s -> %s", versionBefore, badges.version());
        console.log("  Sahip korundu     :", badges.owner());
        console.log("  Kamp sayisi korundu:", badges.campCount());
        console.log("");
    }
}
