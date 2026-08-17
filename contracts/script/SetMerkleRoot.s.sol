// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {PruCampBadges} from "../src/PruCampBadges.sol";

/// @title SetMerkleRoot — Bir haftanın hak ediş listesini yayınlar
///
/// @notice Her hafta sonunda çalıştırılacak script. Backend (Faz 2) o haftayı
///         tamamlayanların listesinden merkle root üretir; bu script o root'u
///         zincire yazar. Root yazıldığı anda katılımcılar rozetlerini
///         alabilir hâle gelir.
///
/// @notice Kullanım:
///
///     CAMP_ID=1 WEEK=4 MERKLE_ROOT=0xabc... \
///     forge script script/SetMerkleRoot.s.sol:SetMerkleRoot \
///       --rpc-url base_sepolia \
///       --account pru-deployer \
///       --broadcast
///
/// @dev ROOT GÜNCELLENEBİLİR. Listeye sonradan biri eklenirse (geç onaylanan
///      başvuru, itiraz vb.) yeni ağaç kurulur ve bu script tekrar
///      çalıştırılır. Zaten rozetini almış olanlar etkilenmez; yalnızca eski
///      proof'lar geçersizleşir ve backend yeni proof'lar dağıtır.
contract SetMerkleRoot is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        uint256 campId = vm.envUint("CAMP_ID");
        uint256 week = vm.envUint("WEEK");
        bytes32 root = vm.envBytes32("MERKLE_ROOT");

        require(proxyAddress != address(0), "PROXY_ADDRESS bos");
        require(root != bytes32(0), "MERKLE_ROOT bos");

        PruCampBadges badges = PruCampBadges(proxyAddress);

        bytes32 previousRoot = badges.merkleRootOf(campId, week);

        vm.startBroadcast();
        badges.setMerkleRoot(campId, week, root);
        vm.stopBroadcast();

        console.log("");
        console.log("=== Merkle root yazildi ===");
        console.log("  Kamp   :", campId);
        console.log("  Hafta  :", week);
        console.logBytes32(previousRoot);
        console.log("  ^ onceki root (sifirsa ilk kez yaziliyor)");
        console.logBytes32(root);
        console.log("  ^ yeni root");
        console.log("");
    }
}
