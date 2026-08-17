// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {BaseTest, MerkleLib} from "./Helpers.sol";
import {MerkleClaim} from "../src/MerkleClaim.sol";
import {
    InvalidMerkleProof,
    MerkleRootNotSet,
    WeekOutOfRange,
    EmptyInput,
    ArrayLengthMismatch
} from "../src/PruTypes.sol";

/// @title Merkle root yönetimi ve proof doğrulama testleri
/// @notice Bu dosya sistemin yetkilendirme kalbini test eder. Merkle proof
///         doğrulamasında bir açık, "herkes her rozeti alabilir" demektir.
contract MerkleRootsTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                              ROOT YAZMA YETKİSİ
    //////////////////////////////////////////////////////////////////////////*/

    function test_SetMerkleRoot_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker
            )
        );
        badges.setMerkleRoot(devCampId, 1, bytes32(uint256(1)));
    }

    function test_SetMerkleRoot_EmitsEvent() public {
        bytes32 root = bytes32(uint256(0xABC));

        vm.expectEmit(true, true, false, true, address(badges));
        emit MerkleClaim.MerkleRootSet(devCampId, 1, bytes32(0), root);

        vm.prank(owner);
        badges.setMerkleRoot(devCampId, 1, root);

        assertEq(badges.merkleRootOf(devCampId, 1), root);
    }

    function test_SetMerkleRoot_RevertsOnInvalidWeek() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(WeekOutOfRange.selector, devCampId, DEV_WEEKS + 1)
        );
        badges.setMerkleRoot(devCampId, DEV_WEEKS + 1, bytes32(uint256(1)));
    }

    /*//////////////////////////////////////////////////////////////////////////
                              ROOT GÜNCELLEME
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev SENARYO: Hafta 1 listesi yayınlandı, sonra geç onaylanan bir
    ///      başvuru geldi. Root güncellenir; yeni kişi rozetini alabilir,
    ///      zaten almış olanlar etkilenmez.
    function test_SetMerkleRoot_CanBeUpdatedToAddParticipant() public {
        _giveNickname(alice, "alice");
        _giveNickname(carol, "carol");

        // 1. tur: sadece alice ve bob listede
        bytes32[] memory round1 = _publishRoot(devCampId, 1, _addresses(alice, bob));

        vm.prank(alice);
        badges.claim(devCampId, 1, MerkleLib.getProof(round1, 0));

        // carol henüz listede değil
        bytes32[] memory emptyProof = new bytes32[](0);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 1));
        badges.claim(devCampId, 1, emptyProof);

        // 2. tur: carol da eklendi, root güncellendi
        bytes32[] memory round2 = _publishRoot(devCampId, 1, _addresses(alice, bob, carol));

        vm.prank(carol);
        badges.claim(devCampId, 1, MerkleLib.getProof(round2, 2));

        assertEq(badges.balanceOf(carol, badges.encodeTokenId(devCampId, 1)), 1);
        // alice'in mevcut rozeti etkilenmedi
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 1);
    }

    /// @dev Root güncellendiğinde ESKİ proof'lar geçersizleşir.
    function test_OldProofInvalidAfterRootUpdate() public {
        _giveNickname(carol, "carol");

        bytes32[] memory round1 = _publishRoot(devCampId, 1, _addresses(alice, bob, carol));
        bytes32[] memory oldProof = MerkleLib.getProof(round1, 2);

        // Root değişti: carol listeden çıkarıldı
        _publishRoot(devCampId, 1, _addresses(alice, bob));

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 1));
        badges.claim(devCampId, 1, oldProof);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              TOPLU ROOT YAZMA
    //////////////////////////////////////////////////////////////////////////*/

    function test_SetMerkleRoots_Batch() public {
        uint256[] memory weekNumbers = _range(1, 3);
        bytes32[] memory roots = new bytes32[](3);
        roots[0] = bytes32(uint256(1));
        roots[1] = bytes32(uint256(2));
        roots[2] = bytes32(uint256(3));

        vm.prank(owner);
        badges.setMerkleRoots(devCampId, weekNumbers, roots);

        assertEq(badges.merkleRootOf(devCampId, 1), roots[0]);
        assertEq(badges.merkleRootOf(devCampId, 2), roots[1]);
        assertEq(badges.merkleRootOf(devCampId, 3), roots[2]);
    }

    function test_SetMerkleRoots_RevertsOnLengthMismatch() public {
        uint256[] memory weekNumbers = _range(1, 3);
        bytes32[] memory roots = new bytes32[](2);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ArrayLengthMismatch.selector, 3, 2));
        badges.setMerkleRoots(devCampId, weekNumbers, roots);
    }

    function test_SetMerkleRoots_RevertsOnEmpty() public {
        uint256[] memory weekNumbers = new uint256[](0);
        bytes32[] memory roots = new bytes32[](0);

        vm.prank(owner);
        vm.expectRevert(EmptyInput.selector);
        badges.setMerkleRoots(devCampId, weekNumbers, roots);
    }

    /*//////////////////////////////////////////////////////////////////////////
                           PROOF'UN YENİDEN KULLANIMI

        Aşağıdaki üç test, bir proof'un BAŞKA bir bağlamda kullanılamayacağını
        kanıtlar. Yaprağın içine hem adres hem campId hem week girdiği için
        proof'lar bağlama sıkı sıkıya bağlıdır.
    //////////////////////////////////////////////////////////////////////////*/

    function test_ProofFromAnotherWeek_IsRejected() public {
        _giveNickname(alice, "alice");

        bytes32[][] memory leavesPerWeek =
            _publishWeekRange(devCampId, 1, 2, _addresses(alice, bob));

        // 1. haftanın proof'uyla 2. haftayı almaya çalış
        bytes32[] memory week1Proof = MerkleLib.getProof(leavesPerWeek[0], 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 2));
        badges.claim(devCampId, 2, week1Proof);
    }

    function test_ProofFromAnotherAccount_IsRejected() public {
        _giveNickname(bob, "bob");

        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, carol));

        // bob listede değil; alice'in proof'unu kullanmaya çalışıyor
        bytes32[] memory aliceProof = MerkleLib.getProof(leaves, 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 1));
        badges.claim(devCampId, 1, aliceProof);
    }

    function test_ProofFromAnotherCamp_IsRejected() public {
        _giveNickname(alice, "alice");

        bytes32[] memory devLeaves = _publishRoot(devCampId, 1, _addresses(alice, bob));

        // Directors kampının 1. haftasına da bir root yazılmış olsun
        _publishRoot(dirCampId, 1, _addresses(carol));

        bytes32[] memory devProof = MerkleLib.getProof(devLeaves, 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, dirCampId, 1));
        badges.claim(dirCampId, 1, devProof);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              RASTGELE PROOF'LAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Rastgele üretilmiş hiçbir proof geçerli olmamalı.
    ///      512 tur fuzzing ile denenir (foundry.toml).
    function testFuzz_RandomProofIsRejected(bytes32[] calldata randomProof) public {
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob, carol));

        // Fuzz'ın tesadüfen doğru proof'u üretmesi kriptografik olarak
        // imkânsız; yine de eşitse testi atla.
        bytes32[] memory validProof = MerkleLib.getProof(leaves, 0);
        vm.assume(keccak256(abi.encode(randomProof)) != keccak256(abi.encode(validProof)));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 1));
        badges.claim(devCampId, 1, randomProof);
    }

    /// @dev Listede olmayan rastgele bir adres rozet alamaz.
    function testFuzz_UnlistedAccountCannotClaim(address outsider) public {
        vm.assume(outsider != alice && outsider != bob && outsider != address(0));
        vm.assume(outsider.code.length == 0); // EOA olsun

        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob));

        vm.prank(outsider);
        badges.registerNickname("outsider");

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(InvalidMerkleProof.selector, devCampId, 1));
        badges.claim(devCampId, 1, MerkleLib.getProof(leaves, 0));
    }

    /*//////////////////////////////////////////////////////////////////////////
                              YAPRAK FORMATI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Yaprak formatının kilitlenmesi. Bu format OpenZeppelin'in
    ///      `merkle-tree` JavaScript kütüphanesindeki `StandardMerkleTree`
    ///      çıktısıyla uyumlu olmak ZORUNDA — backend ağacı onunla kuracak.
    ///
    ///      Bu test formatı değiştirmeye karşı bir bekçidir: birisi çift
    ///      hash'lemeyi tek hash'e indirirse burada kırmızı yanar.
    function test_MerkleLeaf_FormatIsStable() public view {
        bytes32 expected = keccak256(
            bytes.concat(keccak256(abi.encode(alice, devCampId, uint256(3))))
        );
        assertEq(badges.merkleLeaf(alice, devCampId, 3), expected);
    }

    /// @dev Tek yapraklı ağaçta root = yaprak, proof boştur.
    function test_SingleLeafTree_Works() public {
        _giveNickname(alice, "alice");

        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice));
        assertEq(badges.merkleRootOf(devCampId, 1), leaves[0]);

        bytes32[] memory proof = MerkleLib.getProof(leaves, 0);
        assertEq(proof.length, 0);

        vm.prank(alice);
        badges.claim(devCampId, 1, proof);
        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 1);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              YARDIMCI GÖRÜNÜM
    //////////////////////////////////////////////////////////////////////////*/

    function test_IsProofValid_DoesNotRevert() public {
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob));
        bytes32[] memory proof = MerkleLib.getProof(leaves, 0);

        assertTrue(badges.isProofValid(alice, devCampId, 1, proof));
        assertFalse(badges.isProofValid(carol, devCampId, 1, proof));
        // Root yazılmamış hafta için false döner, revert etmez
        assertFalse(badges.isProofValid(alice, devCampId, 5, proof));
    }
}
