// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {BaseTest} from "./Helpers.sol";
import {TransfersDisabled, ApprovalsDisabled} from "../src/PruTypes.sol";

/// @title Soulbound testleri — devredilemezliğin her yoldan zorlandığını kanıtlar
/// @notice Bu dosyadaki testler projenin en kritik güvenlik iddiasını doğrular:
///         "Rozetler satılamaz, devredilemez, hediye edilemez."
///
/// @dev Bir tek transfer yolu bile açık kalırsa rozetler alınıp satılabilir
///      hâle gelir ve tüm başarı kanıtı fikri çöker. Bu yüzden her giriş
///      noktası ayrı ayrı test edilir:
///        1. safeTransferFrom (sahibin kendisi)
///        2. safeBatchTransferFrom (sahibin kendisi)
///        3. safeTransferFrom (üçüncü şahıs / operatör)
///        4. setApprovalForAll (onay verme yolu)
///        5. isApprovedForAll (onayın hiç var olmadığının doğrulanması)
contract SoulboundTest is BaseTest {
    uint256 internal tokenIdWeek1;

    function setUp() public override {
        super.setUp();
        // alice'e 1..3 hafta rozetleri verilir
        _backfillAlice(devCampId, 3);
        tokenIdWeek1 = badges.encodeTokenId(devCampId, 1);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              TRANSFER ENGELLEME
    //////////////////////////////////////////////////////////////////////////*/

    function test_SafeTransferFrom_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TransfersDisabled.selector);
        badges.safeTransferFrom(alice, bob, tokenIdWeek1, 1, "");
    }

    function test_SafeBatchTransferFrom_Reverts() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = badges.encodeTokenId(devCampId, 1);
        ids[1] = badges.encodeTokenId(devCampId, 2);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(alice);
        vm.expectRevert(TransfersDisabled.selector);
        badges.safeBatchTransferFrom(alice, bob, ids, amounts, "");
    }

    /// @dev Kendi kendine transfer de engellidir. Bu önemsiz görünebilir ama
    ///      `from == to` durumunda bakiye değişmeyeceği için bazı
    ///      implementasyonlarda kontroller atlanır; bizde atlanmıyor.
    function test_SelfTransfer_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TransfersDisabled.selector);
        badges.safeTransferFrom(alice, alice, tokenIdWeek1, 1, "");
    }

    /// @dev Üçüncü şahıs transfer denemesi. Onaylar kapalı olduğu için daha
    ///      `_update`'e ulaşmadan ERC-1155'in kendi onay kontrolüne takılır.
    ///      Yani devredilemezlik İKİ katmanda korunuyor.
    function test_ThirdPartyTransfer_Reverts() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155MissingApprovalForAll.selector, bob, alice
            )
        );
        badges.safeTransferFrom(alice, bob, tokenIdWeek1, 1, "");
    }

    /// @dev Hedef adres ne olursa olsun transfer engellenir.
    function testFuzz_TransferAlwaysReverts(address to) public {
        // Sıfır adres ERC-1155'in kendi "geçersiz alıcı" kontrolüne takılır,
        // bu ayrı bir yol olduğu için fuzz kapsamı dışında tutuluyor.
        vm.assume(to != address(0));

        vm.prank(alice);
        vm.expectRevert(TransfersDisabled.selector);
        badges.safeTransferFrom(alice, to, tokenIdWeek1, 1, "");
    }

    /*//////////////////////////////////////////////////////////////////////////
                               ONAY ENGELLEME
    //////////////////////////////////////////////////////////////////////////*/

    function test_SetApprovalForAll_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalsDisabled.selector);
        badges.setApprovalForAll(bob, true);
    }

    /// @dev Onayı kaldırmaya çalışmak da revert eder — fonksiyon tamamen kapalı.
    function test_SetApprovalForAll_RevertsEvenWhenRevoking() public {
        vm.prank(alice);
        vm.expectRevert(ApprovalsDisabled.selector);
        badges.setApprovalForAll(bob, false);
    }

    function test_IsApprovedForAll_AlwaysFalse() public view {
        assertFalse(badges.isApprovedForAll(alice, bob));
        assertFalse(badges.isApprovedForAll(alice, alice));
        assertFalse(badges.isApprovedForAll(address(0), address(0)));
    }

    function testFuzz_IsApprovedForAll_AlwaysFalse(address account, address operator)
        public
        view
    {
        assertFalse(badges.isApprovedForAll(account, operator));
    }

    /*//////////////////////////////////////////////////////////////////////////
                          İZİN VERİLEN YOLLAR ÇALIŞIYOR
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Basım (mint) engellenmemeli — `_update`'teki kural yalnızca
    ///      iki tarafı da sıfır olmayan hareketleri durdurur.
    function test_MintIsAllowed() public view {
        assertEq(badges.balanceOf(alice, tokenIdWeek1), 1);
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 2)), 1);
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 3)), 1);
    }

    /// @dev Yakım (burn) engellenmemeli.
    function test_BurnIsAllowed() public {
        vm.prank(owner);
        badges.adminBurn(alice, devCampId, 1);

        assertEq(badges.balanceOf(alice, tokenIdWeek1), 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 KİLİT SİNYALİ
    //////////////////////////////////////////////////////////////////////////*/

    function test_Locked_AlwaysTrue() public view {
        assertTrue(badges.locked(tokenIdWeek1));
        assertTrue(badges.locked(0));
        assertTrue(badges.locked(type(uint256).max));
    }
}
