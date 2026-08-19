// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {BaseTest} from "./Helpers.sol";
import {OwnershipRenounceDisabled} from "../src/PruTypes.sol";

/// @title Sahiplik devri testleri
/// @notice `Ownable2Step`'in iki adımlı devri, yanlış adrese devretme sonucu
///         kontratın kalıcı olarak kilitlenmesini engeller.
///
/// @dev NEDEN İKİ ADIMLI DEVİR:
///      Düz `transferOwnership` ile bir yazım hatası (veya kontrat adresi
///      girmek) kontratı ÖLDÜRÜR: yeni "sahip" adres erişilemez olduğu için
///      bir daha merkle root yazılamaz, upgrade yapılamaz, duraklatma
///      kaldırılamaz. İki adımlı modelde yeni sahibin `acceptOwnership()`
///      çağırması gerekir — erişemediği bir adrese devir mümkün değildir.
contract OwnershipTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                                  BAŞLANGIÇ
    //////////////////////////////////////////////////////////////////////////*/

    function test_InitialOwner() public view {
        assertEq(badges.owner(), owner);
        assertEq(badges.pendingOwner(), address(0));
    }

    /*//////////////////////////////////////////////////////////////////////////
                                İKİ ADIMLI DEVİR
    //////////////////////////////////////////////////////////////////////////*/

    function test_TransferOwnership_RequiresTwoSteps() public {
        vm.prank(owner);
        badges.transferOwnership(newOwner);

        // 1. adımdan sonra sahiplik HÂLÂ eski sahipte
        assertEq(badges.owner(), owner);
        assertEq(badges.pendingOwner(), newOwner);

        // 2. adım: yeni sahip kabul eder
        vm.prank(newOwner);
        badges.acceptOwnership();

        assertEq(badges.owner(), newOwner);
        assertEq(badges.pendingOwner(), address(0));
    }

    /// @dev Bekleyen sahip, kabul etmeden önce hiçbir yetkiye sahip değildir.
    function test_PendingOwner_HasNoPowersBeforeAccepting() public {
        vm.prank(owner);
        badges.transferOwnership(newOwner);

        vm.prank(newOwner);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, newOwner)
        );
        badges.createCamp("Erken Kamp", 5);
    }

    /// @dev Eski sahip, devir kabul edilene kadar yetkisini korur.
    ///      Bu kritik: aksi hâlde devir sürecinde kontrat sahipsiz kalırdı.
    function test_OldOwner_KeepsPowersUntilAccepted() public {
        vm.prank(owner);
        badges.transferOwnership(newOwner);

        vm.prank(owner);
        uint256 campId = badges.createCamp("Ara Kamp", 5);

        assertEq(badges.getCamp(campId).name, "Ara Kamp");
    }

    function test_AcceptOwnership_OnlyPendingOwner() public {
        vm.prank(owner);
        badges.transferOwnership(newOwner);

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.acceptOwnership();
    }

    function test_TransferOwnership_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.transferOwnership(attacker);
    }

    /// @dev Devir iptal edilebilir: bekleyen sahip sıfırlanır.
    function test_TransferOwnership_CanBeCancelled() public {
        vm.startPrank(owner);
        badges.transferOwnership(newOwner);
        badges.transferOwnership(address(0));
        vm.stopPrank();

        assertEq(badges.pendingOwner(), address(0));
        assertEq(badges.owner(), owner);

        vm.prank(newOwner);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, newOwner)
        );
        badges.acceptOwnership();
    }

    /// @dev Devir tamamlandıktan sonra eski sahip yetkisini kaybeder.
    function test_OldOwner_LosesPowersAfterTransfer() public {
        vm.prank(owner);
        badges.transferOwnership(newOwner);

        vm.prank(newOwner);
        badges.acceptOwnership();

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, owner)
        );
        badges.createCamp("Eski Sahip Kampi", 5);

        // Yeni sahip yapabilir
        vm.prank(newOwner);
        badges.createCamp("Yeni Sahip Kampi", 5);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              FERAGAT DEVRE DIŞI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev `renounceOwnership` bilinçli olarak kapatıldı.
    ///      Bu kontratta feragat etmek kampı geri dönülemez şekilde öldürür:
    ///      bir daha root yazılamaz, upgrade yapılamaz, duraklatma kaldırılamaz.
    ///      Blok gezgininden yanlışlıkla tek tıkla tetiklenebilecek bir işlem
    ///      olduğu için açık bırakmak sorumsuzluk olurdu.
    function test_RenounceOwnership_IsDisabled() public {
        vm.prank(owner);
        vm.expectRevert(OwnershipRenounceDisabled.selector);
        badges.renounceOwnership();

        assertEq(badges.owner(), owner);
    }

    function test_RenounceOwnership_DisabledForEveryone() public {
        vm.prank(attacker);
        vm.expectRevert(OwnershipRenounceDisabled.selector);
        badges.renounceOwnership();
    }

    /*//////////////////////////////////////////////////////////////////////////
                            SAHİPLİĞE BAĞLI YETKİLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Yönetici fonksiyonlarının tamamının erişim kontrolüne bağlı
    ///      olduğunu tek testte tarar. Yeni bir yönetici fonksiyonu eklenip
    ///      `onlyOwner` unutulursa bu listeye eklendiğinde yakalanır.
    function test_AllAdminFunctions_RejectNonOwner() public {
        bytes memory expectedError = abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker
        );

        vm.startPrank(attacker);

        vm.expectRevert(expectedError);
        badges.createCamp("x", 1);

        vm.expectRevert(expectedError);
        badges.setCampName(devCampId, "x");

        vm.expectRevert(expectedError);
        badges.setCampWeekCount(devCampId, 20);

        vm.expectRevert(expectedError);
        badges.setCampActive(devCampId, false);

        vm.expectRevert(expectedError);
        badges.setMerkleRoot(devCampId, 1, bytes32(uint256(1)));

        vm.expectRevert(expectedError);
        badges.adminBurn(alice, devCampId, 1);

        vm.expectRevert(expectedError);
        badges.pause();

        vm.expectRevert(expectedError);
        badges.unpause();

        vm.expectRevert(expectedError);
        badges.setBaseURI("x");

        vm.expectRevert(expectedError);
        badges.setContractURI("x");

        vm.expectRevert(expectedError);
        badges.freezeMetadata();

        vm.stopPrank();
    }
}
