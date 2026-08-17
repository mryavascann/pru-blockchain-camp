// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {BaseTest, MerkleLib} from "./Helpers.sol";
import {
    AlreadyClaimed,
    MerkleRootNotSet,
    InvalidMerkleProof,
    NicknameRequired,
    CampNotActive,
    CampNotFound,
    WeekOutOfRange,
    EmptyInput,
    ArrayLengthMismatch
} from "../src/PruTypes.sol";

/// @title Rozet basımı testleri
/// @notice Tekil alım, toplu alım (geri doldurma) ve tüm reddedilme
///         senaryolarını kapsar.
contract MintingTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                                 TEKİL ALIM
    //////////////////////////////////////////////////////////////////////////*/

    function test_Claim_Success() public {
        _giveNickname(alice, "alice");

        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob));

        vm.prank(alice);
        badges.claim(devCampId, 1, MerkleLib.getProof(leaves, 0));

        uint256 tokenId = badges.encodeTokenId(devCampId, 1);
        assertEq(badges.balanceOf(alice, tokenId), 1);
        assertTrue(badges.hasClaimed(tokenId, alice));
        assertEq(badges.claimedAt(tokenId, alice), uint64(block.timestamp));
    }

    /// @dev Aynı rozet iki kez alınamaz. Bu, sistemin en temel değişmezidir.
    function test_Claim_RevertsWhenAlreadyClaimed() public {
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob));
        bytes32[] memory proof = MerkleLib.getProof(leaves, 0);

        vm.prank(alice);
        badges.claim(devCampId, 1, proof);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AlreadyClaimed.selector, devCampId, 1));
        badges.claim(devCampId, 1, proof);
    }

    function test_Claim_RevertsWhenRootNotSet() public {
        _giveNickname(alice, "alice");

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MerkleRootNotSet.selector, devCampId, 1));
        badges.claim(devCampId, 1, emptyProof);
    }

    /// @dev Nick zorunluluğu: leaderboard'un "rozeti olan herkesin nicki
    ///      vardır" değişmezi kontrat seviyesinde korunur.
    function test_Claim_RevertsWithoutNickname() public {
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice));

        vm.prank(alice);
        vm.expectRevert(NicknameRequired.selector);
        badges.claim(devCampId, 1, MerkleLib.getProof(leaves, 0));
    }

    function test_Claim_RevertsWhenPaused() public {
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice));

        vm.prank(owner);
        badges.pause();

        vm.prank(alice);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        badges.claim(devCampId, 1, MerkleLib.getProof(leaves, 0));
    }

    function test_Claim_RevertsWhenCampInactive() public {
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice));

        vm.prank(owner);
        badges.setCampActive(devCampId, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CampNotActive.selector, devCampId));
        badges.claim(devCampId, 1, MerkleLib.getProof(leaves, 0));
    }

    function test_Claim_RevertsOnUnknownCamp() public {
        _giveNickname(alice, "alice");

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CampNotFound.selector, 99));
        badges.claim(99, 1, emptyProof);
    }

    /// @dev 15 haftalık kampta 16. hafta talep edilemez.
    function test_Claim_RevertsOnWeekOutOfRange() public {
        _giveNickname(alice, "alice");

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(WeekOutOfRange.selector, devCampId, DEV_WEEKS + 1)
        );
        badges.claim(devCampId, DEV_WEEKS + 1, emptyProof);
    }

    function test_Claim_RevertsOnWeekZero() public {
        _giveNickname(alice, "alice");

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WeekOutOfRange.selector, devCampId, 0));
        badges.claim(devCampId, 0, emptyProof);
    }

    /*//////////////////////////////////////////////////////////////////////////
                         TOPLU ALIM / GERİ DOLDURMA
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev PROJENİN ANA SENARYOSU:
    ///      Kampın 3. haftasında katılan biri 1., 2. ve 3. hafta rozetlerinin
    ///      hepsini TEK işlemde alır.
    function test_ClaimBatch_Backfill() public {
        _giveNickname(alice, "alice");

        address[] memory participants = _addresses(alice, bob, carol);
        bytes32[][] memory leavesPerWeek = _publishWeekRange(devCampId, 1, 3, participants);

        vm.prank(alice);
        badges.claimBatch(devCampId, _range(1, 3), _proofsFor(leavesPerWeek, 0));

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 1);
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 2)), 1);
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 3)), 1);
        assertEq(badges.claimedWeekCount(alice, devCampId), 3);
    }

    /// @dev Dizide aynı hafta iki kez geçerse ikinci geçiş engellenir.
    function test_ClaimBatch_RevertsOnDuplicateWeek() public {
        _giveNickname(alice, "alice");

        bytes32[][] memory leavesPerWeek =
            _publishWeekRange(devCampId, 1, 2, _addresses(alice, bob));

        uint256[] memory weekNumbers = new uint256[](2);
        weekNumbers[0] = 1;
        weekNumbers[1] = 1; // tekrar

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = MerkleLib.getProof(leavesPerWeek[0], 0);
        proofs[1] = MerkleLib.getProof(leavesPerWeek[0], 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AlreadyClaimed.selector, devCampId, 1));
        badges.claimBatch(devCampId, weekNumbers, proofs);
    }

    function test_ClaimBatch_RevertsOnLengthMismatch() public {
        _giveNickname(alice, "alice");
        _publishWeekRange(devCampId, 1, 2, _addresses(alice));

        uint256[] memory weekNumbers = _range(1, 2);
        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = new bytes32[](0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArrayLengthMismatch.selector, 2, 1));
        badges.claimBatch(devCampId, weekNumbers, proofs);
    }

    function test_ClaimBatch_RevertsOnEmptyInput() public {
        _giveNickname(alice, "alice");

        uint256[] memory weekNumbers = new uint256[](0);
        bytes32[][] memory proofs = new bytes32[][](0);

        vm.prank(alice);
        vm.expectRevert(EmptyInput.selector);
        badges.claimBatch(devCampId, weekNumbers, proofs);
    }

    /// @dev Toplu alımda tek bir geçersiz proof tüm işlemi geri alır —
    ///      kısmi başarı diye bir şey yoktur.
    function test_ClaimBatch_RevertsIfAnyProofInvalid() public {
        _giveNickname(alice, "alice");

        bytes32[][] memory leavesPerWeek =
            _publishWeekRange(devCampId, 1, 3, _addresses(alice, bob));

        bytes32[][] memory proofs = _proofsFor(leavesPerWeek, 0);
        proofs[2] = new bytes32[](0); // 3. haftanın proof'unu boz

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 3));
        badges.claimBatch(devCampId, _range(1, 3), proofs);

        // Hiçbir rozet basılmamış olmalı
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                          NICK + ALIM TEK İŞLEMDE
    //////////////////////////////////////////////////////////////////////////*/

    function test_RegisterAndClaimBatch_Success() public {
        bytes32[][] memory leavesPerWeek =
            _publishWeekRange(devCampId, 1, 3, _addresses(alice, bob));

        vm.prank(alice);
        badges.registerAndClaimBatch(
            "alice", devCampId, _range(1, 3), _proofsFor(leavesPerWeek, 0)
        );

        assertEq(badges.nicknameOf(alice), "alice");
        assertEq(badges.claimedWeekCount(alice, devCampId), 3);
    }

    /*//////////////////////////////////////////////////////////////////////////
                          ÇOKLU KAMP BAĞIMSIZLIĞI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Bir kişi iki kampa birden katılabilir; ilerlemeleri birbirinden
    ///      tamamen bağımsızdır.
    function test_MultipleCamps_ProgressIsIndependent() public {
        _giveNickname(alice, "alice");

        bytes32[][] memory devLeaves = _publishWeekRange(devCampId, 1, 3, _addresses(alice));
        bytes32[][] memory dirLeaves = _publishWeekRange(dirCampId, 1, 2, _addresses(alice));

        vm.startPrank(alice);
        badges.claimBatch(devCampId, _range(1, 3), _proofsFor(devLeaves, 0));
        badges.claimBatch(dirCampId, _range(1, 2), _proofsFor(dirLeaves, 0));
        vm.stopPrank();

        assertEq(badges.claimedWeekCount(alice, devCampId), 3);
        assertEq(badges.claimedWeekCount(alice, dirCampId), 2);

        // tokenId'ler çakışmıyor
        assertTrue(
            badges.encodeTokenId(devCampId, 1) != badges.encodeTokenId(dirCampId, 1)
        );
    }

    /// @dev Bir kampın duraklatılması diğerini etkilemez.
    function test_CampInactive_DoesNotAffectOtherCamp() public {
        _giveNickname(alice, "alice");

        bytes32[] memory dirLeaves = _publishRoot(dirCampId, 1, _addresses(alice));

        vm.prank(owner);
        badges.setCampActive(devCampId, false);

        vm.prank(alice);
        badges.claim(dirCampId, 1, MerkleLib.getProof(dirLeaves, 0));

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(dirCampId, 1)), 1);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                  İLERLEME
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev `progressOf` frontend'deki ilerleme kutucuklarını besler.
    ///      Dizinin uzunluğu VERİDEN gelir — hiçbir yerde sabit "15" yoktur.
    function test_ProgressOf_ReflectsClaims() public {
        _backfillAlice(devCampId, 3);

        bool[] memory progress = badges.progressOf(alice, devCampId);

        assertEq(progress.length, DEV_WEEKS);
        assertTrue(progress[0]);
        assertTrue(progress[1]);
        assertTrue(progress[2]);
        assertFalse(progress[3]);
        assertFalse(progress[DEV_WEEKS - 1]);
    }

    function test_ProgressOf_GrowsWithWeekCount() public {
        vm.prank(owner);
        badges.setCampWeekCount(devCampId, 18);

        bool[] memory progress = badges.progressOf(alice, devCampId);
        assertEq(progress.length, 18);
    }
}
