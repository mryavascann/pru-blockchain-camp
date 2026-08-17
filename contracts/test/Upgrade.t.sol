// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {BaseTest, MerkleLib} from "./Helpers.sol";
import {PruCampBadges} from "../src/PruCampBadges.sol";
import {Camp} from "../src/PruTypes.sol";

/// @title PruCampBadgesV2Mock — Upgrade testleri için sahte 2. sürüm
/// @notice Gerçek bir sürüm değildir; yalnızca upgrade mekanizmasının
///         çalıştığını ve durumun korunduğunu kanıtlamak için kullanılır.
///
/// @dev DEPOLAMA GÜVENLİĞİ:
///      Yeni değişken (`extraValue`) mevcut düzenin SONUNA eklenir.
///      `PruCampBadges` tüm modüllerinde `__gap` bıraktığı için bu ekleme
///      hiçbir mevcut slotu bozmaz.
contract PruCampBadgesV2Mock is PruCampBadges {
    /// @dev V2'de eklenen yeni durum değişkeni.
    uint256 public extraValue;

    function setExtraValue(uint256 value) external onlyOwner {
        extraValue = value;
    }

    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
}

/// @title Upgrade (UUPS) testleri
/// @notice Proxy modelinin en kritik iki iddiasını doğrular:
///           1. Mantık değişebilir.
///           2. Değiştiğinde HİÇBİR VERİ KAYBOLMAZ.
contract UpgradeTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                            INITIALIZER KORUMASI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Implementation kontratı DOĞRUDAN kurulamaz.
    ///
    ///      Bu koruma olmasaydı bir saldırgan implementation'ı kendi adına
    ///      `initialize` edip onun sahibi olur, sonra UUPS'in
    ///      `upgradeToAndCall`'unu kullanarak implementation'ı `selfdestruct`
    ///      içeren bir kontrata yönlendirip yok edebilirdi. Proxy o anda
    ///      boşluğa işaret eden ölü bir kontrata dönüşürdü.
    function test_Implementation_CannotBeInitialized() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(attacker, BASE_URI, CONTRACT_URI);
    }

    function test_Proxy_CannotBeInitializedTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        badges.initialize(attacker, BASE_URI, CONTRACT_URI);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              UPGRADE YETKİSİ
    //////////////////////////////////////////////////////////////////////////*/

    function test_Upgrade_OnlyOwner() public {
        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker
            )
        );
        badges.upgradeToAndCall(address(v2), "");
    }

    function test_Upgrade_Succeeds() public {
        assertEq(badges.version(), "1.0.0");

        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();

        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        assertEq(badges.version(), "2.0.0");
    }

    function test_Upgrade_NewFunctionBecomesAvailable() public {
        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();

        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        PruCampBadgesV2Mock upgraded = PruCampBadgesV2Mock(address(badges));

        vm.prank(owner);
        upgraded.setExtraValue(42);

        assertEq(upgraded.extraValue(), 42);
    }

    /*//////////////////////////////////////////////////////////////////////////
                        EN ÖNEMLİ TEST: DURUM KORUNUYOR MU
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev PROXY'NİN VAROLUŞ SEBEBİNİN KANITI.
    ///
    ///      Gerçekçi bir durum kurulur (kamplar, nickler, merkle root'lar,
    ///      basılmış rozetler), sonra upgrade yapılır ve HER ŞEYİN yerinde
    ///      olduğu doğrulanır.
    ///
    ///      Immutable bir kontratta bunun karşılığı şu olurdu: yeni kontrat
    ///      deploy → yeni adres → tüm rozetler ölü → herkes yeniden mint
    ///      etmek zorunda → leaderboard geçmişi kopuk.
    function test_Upgrade_PreservesAllState() public {
        // ---- 1. Zengin bir durum kur ----
        _giveNickname(alice, "alice");
        _giveNickname(bob, "bob");

        address[] memory participants = _addresses(alice, bob);
        bytes32[][] memory devLeaves = _publishWeekRange(devCampId, 1, 3, participants);
        bytes32[][] memory dirLeaves = _publishWeekRange(dirCampId, 1, 2, participants);

        vm.startPrank(alice);
        badges.claimBatch(devCampId, _range(1, 3), _proofsFor(devLeaves, 0));
        badges.claimBatch(dirCampId, _range(1, 2), _proofsFor(dirLeaves, 0));
        vm.stopPrank();

        vm.prank(bob);
        badges.claimBatch(devCampId, _range(1, 3), _proofsFor(devLeaves, 1));

        // Upgrade öncesi anlık görüntü
        bytes32 devWeek1Root = badges.merkleRootOf(devCampId, 1);
        uint256 devWeek1TokenId = badges.encodeTokenId(devCampId, 1);
        uint64 aliceClaimTime = badges.claimedAt(devWeek1TokenId, alice);

        // ---- 2. Upgrade ----
        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();
        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        assertEq(badges.version(), "2.0.0", "surum guncellenmedi");

        // ---- 3. Her şey yerinde mi? ----

        // Sahiplik
        assertEq(badges.owner(), owner, "sahip degisti");

        // Kamplar
        assertEq(badges.campCount(), 2, "kamp sayisi degisti");
        Camp memory dev = badges.getCamp(devCampId);
        assertEq(dev.name, DEV_CAMP_NAME, "kamp adi degisti");
        assertEq(dev.weekCount, DEV_WEEKS, "hafta sayisi degisti");
        assertTrue(dev.active, "kamp pasiflesti");

        // Nickler
        assertEq(badges.nicknameOf(alice), "alice", "alice nicki kayboldu");
        assertEq(badges.nicknameOf(bob), "bob", "bob nicki kayboldu");
        assertEq(badges.ownerOfNickname("alice"), alice, "nick sahipligi bozuldu");

        // Merkle root'lar
        assertEq(badges.merkleRootOf(devCampId, 1), devWeek1Root, "root degisti");

        // Rozetler
        assertEq(badges.balanceOf(alice, devWeek1TokenId), 1, "alice rozeti kayboldu");
        assertEq(badges.claimedWeekCount(alice, devCampId), 3, "alice dev ilerlemesi bozuldu");
        assertEq(badges.claimedWeekCount(alice, dirCampId), 2, "alice dir ilerlemesi bozuldu");
        assertEq(badges.claimedWeekCount(bob, devCampId), 3, "bob ilerlemesi bozuldu");

        // Talep zaman damgaları (burn penceresi bunlara dayanıyor)
        assertEq(badges.claimedAt(devWeek1TokenId, alice), aliceClaimTime, "zaman damgasi bozuldu");

        // Metadata
        assertEq(badges.uri(0), BASE_URI, "URI degisti");
    }

    /// @dev Upgrade sonrası sistem çalışmaya devam etmeli — sadece veri
    ///      korunmuş olması yetmez, yeni işlemler de kabul edilmeli.
    function test_Upgrade_SystemKeepsWorkingAfterwards() public {
        _giveNickname(alice, "alice");

        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();
        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        // Upgrade'den SONRA yeni bir hafta yayınlanıp rozet alınabiliyor mu?
        bytes32[] memory leaves = _publishRoot(devCampId, 5, _addresses(alice, bob));

        vm.prank(alice);
        badges.claim(devCampId, 5, MerkleLib.getProof(leaves, 0));

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 5)), 1);

        // Yeni kamp da açılabiliyor mu?
        vm.prank(owner);
        uint256 newCamp = badges.createCamp("Upgrade Sonrasi Kamp", 4);
        assertEq(newCamp, 3);
    }

    /// @dev Yeni değişken eklemek mevcut hiçbir slotu bozmamalı.
    ///      `__gap` mekanizmasının çalıştığının kanıtı.
    function test_Upgrade_NewStorageDoesNotCorruptOldState() public {
        _backfillAlice(devCampId, 3);

        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();
        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        PruCampBadgesV2Mock upgraded = PruCampBadgesV2Mock(address(badges));

        // Yeni değişkene yaz
        vm.prank(owner);
        upgraded.setExtraValue(type(uint256).max);

        // Eski durum bozulmamış olmalı
        assertEq(upgraded.extraValue(), type(uint256).max);
        assertEq(badges.claimedWeekCount(alice, devCampId), 3);
        assertEq(badges.nicknameOf(alice), "alice");
        assertEq(badges.campCount(), 2);
        assertEq(badges.getCamp(devCampId).weekCount, DEV_WEEKS);
    }

    /*//////////////////////////////////////////////////////////////////////////
                            SOULBOUND KORUNUYOR MU
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Upgrade sonrası devredilemezlik hâlâ geçerli olmalı.
    ///      (V2Mock `_update`'i override etmiyor, dolayısıyla V1'in kuralı
    ///      miras alınıyor. Bu test, gelecekte biri override edip kuralı
    ///      kaldırırsa uyarı verir.)
    function test_Upgrade_SoulboundStillEnforced() public {
        _backfillAlice(devCampId, 1);

        PruCampBadgesV2Mock v2 = new PruCampBadgesV2Mock();
        vm.prank(owner);
        badges.upgradeToAndCall(address(v2), "");

        vm.prank(alice);
        vm.expectRevert();
        badges.safeTransferFrom(alice, bob, badges.encodeTokenId(devCampId, 1), 1, "");
    }
}
