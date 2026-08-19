// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {BaseTest, MerkleLib} from "./Helpers.sol";
import {CampRegistry} from "../src/CampRegistry.sol";
import {PruCampBadges} from "../src/PruCampBadges.sol";
import {
    Camp,
    CampNotFound,
    CampNameEmpty,
    WeekCountZero,
    WeekCountCannotDecrease,
    InvalidTokenIdInput,
    NothingToBurn,
    BurnWindowExpired,
    AlreadyClaimed,
    MetadataIsFrozen,
    EmptyURI
} from "../src/PruTypes.sol";

/// @title Kamp yönetimi, tokenId kodlaması, duraklatma ve yakma testleri
/// @notice Bu dosya "genişletilebilirlik" şartının kanıtıdır: yeni kamp ve
///         yeni hafta eklemek yalnızca birer işlemdir.
contract CampAdminTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                                KAMP OLUŞTURMA
    //////////////////////////////////////////////////////////////////////////*/

    function test_CreateCamp_Success() public view {
        Camp memory dev = badges.getCamp(devCampId);

        assertEq(dev.name, DEV_CAMP_NAME);
        assertEq(dev.weekCount, DEV_WEEKS);
        assertTrue(dev.active);
        assertTrue(dev.exists);
        assertEq(badges.campCount(), 2);
    }

    /// @dev GENİŞLETİLEBİLİRLİĞİN KANITI:
    ///      3. ve 4. kamp, kontrata dokunmadan, deploy yapmadan açılır.
    function test_CreateCamp_NewCampsNeedNoDeploy() public {
        vm.startPrank(owner);
        uint256 thirdCamp = badges.createCamp("PRU Blockchain Designers", 8);
        uint256 fourthCamp = badges.createCamp("PRU Blockchain Researchers", 20);
        vm.stopPrank();

        assertEq(thirdCamp, 3);
        assertEq(fourthCamp, 4);
        assertEq(badges.campCount(), 4);
        assertEq(badges.getCamp(thirdCamp).weekCount, 8);
        assertEq(badges.getCamp(fourthCamp).weekCount, 20);
    }

    function test_CreateCamp_EmitsEvent() public {
        vm.expectEmit(true, false, false, true, address(badges));
        emit CampRegistry.CampCreated(3, "Yeni Kamp", 6);

        vm.prank(owner);
        badges.createCamp("Yeni Kamp", 6);
    }

    function test_CreateCamp_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.createCamp("Sahte Kamp", 5);
    }

    function test_CreateCamp_RevertsOnEmptyName() public {
        vm.prank(owner);
        vm.expectRevert(CampNameEmpty.selector);
        badges.createCamp("", 5);
    }

    function test_CreateCamp_RevertsOnZeroWeeks() public {
        vm.prank(owner);
        vm.expectRevert(WeekCountZero.selector);
        badges.createCamp("Kamp", 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 KAMP SORGULARI
    //////////////////////////////////////////////////////////////////////////*/

    function test_GetCamp_RevertsOnUnknownCamp() public {
        vm.expectRevert(abi.encodeWithSelector(CampNotFound.selector, 99));
        badges.getCamp(99);
    }

    function test_CampExists() public view {
        assertTrue(badges.campExists(devCampId));
        assertFalse(badges.campExists(99));
    }

    function test_GetAllCamps() public view {
        (uint256[] memory ids, Camp[] memory items) = badges.getAllCamps();

        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(items[0].name, DEV_CAMP_NAME);
        assertEq(items[1].name, DIR_CAMP_NAME);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                  KAMP ADI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Kamp adı değiştirilebilir olmalı — kamplar her dönem tekrarlanan,
    ///      adı değişebilen yapılar.
    function test_SetCampName() public {
        vm.prank(owner);
        badges.setCampName(devCampId, "PRU Blockchain Developers 2027");

        assertEq(badges.getCamp(devCampId).name, "PRU Blockchain Developers 2027");
    }

    function test_SetCampName_RevertsOnEmpty() public {
        vm.prank(owner);
        vm.expectRevert(CampNameEmpty.selector);
        badges.setCampName(devCampId, "");
    }

    function test_SetCampName_RevertsOnUnknownCamp() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CampNotFound.selector, 99));
        badges.setCampName(99, "Olmayan Kamp");
    }

    function test_SetCampName_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.setCampName(devCampId, "Ele Gecirildi");
    }

    /*//////////////////////////////////////////////////////////////////////////
                                HAFTA SAYISI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev GENİŞLETİLEBİLİRLİĞİN İKİNCİ KANITI: 15 hafta → 18 hafta.
    function test_SetCampWeekCount_CanIncrease() public {
        vm.prank(owner);
        badges.setCampWeekCount(devCampId, 18);

        assertEq(badges.getCamp(devCampId).weekCount, 18);

        // Artık 18. hafta için root yazılabilir ve rozet alınabilir
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 18, _addresses(alice));

        vm.prank(alice);
        badges.claim(devCampId, 18, MerkleLib.getProof(leaves, 0));

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 18)), 1);
    }

    /// @dev Hafta sayısı AZALTILAMAZ — azaltmak, basılmış rozetleri "geçersiz
    ///      hafta"ya düşürüp tutarsızlık yaratırdı.
    function test_SetCampWeekCount_RevertsOnDecrease() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(WeekCountCannotDecrease.selector, DEV_WEEKS, 10));
        badges.setCampWeekCount(devCampId, 10);
    }

    function test_SetCampWeekCount_AllowsSameValue() public {
        vm.prank(owner);
        badges.setCampWeekCount(devCampId, DEV_WEEKS);
        assertEq(badges.getCamp(devCampId).weekCount, DEV_WEEKS);
    }

    function test_SetCampWeekCount_RevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(WeekCountZero.selector);
        badges.setCampWeekCount(devCampId, 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                KAMP AKTİFLİĞİ
    //////////////////////////////////////////////////////////////////////////*/

    function test_SetCampActive_Toggle() public {
        vm.startPrank(owner);
        badges.setCampActive(devCampId, false);
        assertFalse(badges.getCamp(devCampId).active);

        badges.setCampActive(devCampId, true);
        assertTrue(badges.getCamp(devCampId).active);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////////////////
                              TOKEN ID KODLAMASI
    //////////////////////////////////////////////////////////////////////////*/

    function test_EncodeTokenId_KnownValues() public view {
        // Kamp 1, Hafta 3  →  (1 << 16) | 3  = 65539
        assertEq(badges.encodeTokenId(1, 3), 65_539);
        // Kamp 2, Hafta 12 →  (2 << 16) | 12 = 131084
        assertEq(badges.encodeTokenId(2, 12), 131_084);
    }

    function test_DecodeTokenId() public view {
        (uint256 campId, uint256 week) = badges.decodeTokenId(65_539);
        assertEq(campId, 1);
        assertEq(week, 3);
    }

    function test_EncodeTokenId_RevertsOnZeroCamp() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenIdInput.selector, 0, 1));
        badges.encodeTokenId(0, 1);
    }

    function test_EncodeTokenId_RevertsOnZeroWeek() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenIdInput.selector, 1, 0));
        badges.encodeTokenId(1, 0);
    }

    function test_EncodeTokenId_RevertsOnWeekOverflow() public {
        uint256 tooBig = uint256(type(uint16).max) + 1;
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenIdInput.selector, 1, tooBig));
        badges.encodeTokenId(1, tooBig);
    }

    /// @dev campId üst 240 bite sığmalı; aşarsa hafta bitleriyle çakışırdı.
    function test_EncodeTokenId_RevertsOnCampIdOverflow() public {
        uint256 tooBig = uint256(type(uint240).max) + 1;
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenIdInput.selector, tooBig, 1));
        badges.encodeTokenId(tooBig, 1);
    }

    /// @dev Kodlama ve çözme her zaman birbirinin tersi olmalı.
    ///      Bu, tokenId şemasının en temel değişmezidir.
    function testFuzz_EncodeDecodeRoundTrip(
        uint240 campIdSeed,
        uint16 weekSeed
    ) public view {
        uint256 campId = uint256(campIdSeed);
        uint256 week = uint256(weekSeed);
        vm.assume(campId > 0);
        vm.assume(week > 0);

        uint256 tokenId = badges.encodeTokenId(campId, week);
        (uint256 decodedCamp, uint256 decodedWeek) = badges.decodeTokenId(tokenId);

        assertEq(decodedCamp, campId);
        assertEq(decodedWeek, week);
    }

    /// @dev Farklı (kamp, hafta) ikilileri asla aynı tokenId üretmemeli.
    function testFuzz_TokenIdsNeverCollide(
        uint240 campA,
        uint16 weekA,
        uint240 campB,
        uint16 weekB
    ) public view {
        vm.assume(campA > 0 && campB > 0 && weekA > 0 && weekB > 0);
        vm.assume(campA != campB || weekA != weekB);

        assertTrue(badges.encodeTokenId(campA, weekA) != badges.encodeTokenId(campB, weekB));
    }

    /*//////////////////////////////////////////////////////////////////////////
                                  DURAKLATMA
    //////////////////////////////////////////////////////////////////////////*/

    function test_Pause_Unpause() public {
        vm.prank(owner);
        badges.pause();
        assertTrue(badges.paused());

        vm.prank(owner);
        badges.unpause();
        assertFalse(badges.paused());
    }

    function test_Pause_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.pause();
    }

    function test_Pause_BlocksNicknameRegistration() public {
        vm.prank(owner);
        badges.pause();

        vm.prank(alice);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        badges.registerNickname("alice");
    }

    /// @dev Duraklatma yalnızca YENİ basımı durdurur; mevcut rozetler durur.
    function test_Pause_DoesNotAffectExistingBadges() public {
        _backfillAlice(devCampId, 2);

        vm.prank(owner);
        badges.pause();

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 1);
        assertEq(badges.claimedWeekCount(alice, devCampId), 2);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                    YAKMA
    //////////////////////////////////////////////////////////////////////////*/

    function test_AdminBurn_WithinWindow() public {
        _backfillAlice(devCampId, 2);
        uint256 tokenId = badges.encodeTokenId(devCampId, 1);

        vm.warp(block.timestamp + 6 days);

        vm.expectEmit(true, true, true, true, address(badges));
        emit PruCampBadges.BadgeBurned(alice, devCampId, 1, tokenId);

        vm.prank(owner);
        badges.adminBurn(alice, devCampId, 1);

        assertEq(badges.balanceOf(alice, tokenId), 0);
        assertEq(badges.claimedWeekCount(alice, devCampId), 1);
    }

    function test_AdminBurn_AtExactWindowBoundary() public {
        _backfillAlice(devCampId, 1);

        // Tam 7 gün sonra hâlâ mümkün (sınır dâhil)
        vm.warp(block.timestamp + 7 days);

        vm.prank(owner);
        badges.adminBurn(alice, devCampId, 1);

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 0);
    }

    /// @dev 7 GÜNLÜK PENCERENİN KANITI:
    ///      8. günde yönetici bile rozeti silemez. Rozetlerin kalıcılığı
    ///      kontratın zorladığı bir kuraldır, bir söz değil.
    function test_AdminBurn_RevertsAfterWindow() public {
        _backfillAlice(devCampId, 1);
        uint256 tokenId = badges.encodeTokenId(devCampId, 1);
        uint64 deadline = badges.claimedAt(tokenId, alice) + badges.BURN_WINDOW();

        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BurnWindowExpired.selector, deadline));
        badges.adminBurn(alice, devCampId, 1);

        // Rozet yerinde
        assertEq(badges.balanceOf(alice, tokenId), 1);
    }

    function test_AdminBurn_OnlyOwner() public {
        _backfillAlice(devCampId, 1);

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.adminBurn(alice, devCampId, 1);
    }

    function test_AdminBurn_RevertsWhenNothingToBurn() public {
        uint256 tokenId = badges.encodeTokenId(devCampId, 1);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(NothingToBurn.selector, alice, tokenId));
        badges.adminBurn(alice, devCampId, 1);
    }

    /// @dev Yakma KALICIDIR: kullanıcı aynı proof ile rozeti tekrar alamaz.
    ///      Bu olmasaydı yakma işlemi hiçbir işe yaramazdı.
    function test_AdminBurn_CannotBeReclaimed() public {
        _giveNickname(alice, "alice");
        bytes32[] memory leaves = _publishRoot(devCampId, 1, _addresses(alice, bob));
        bytes32[] memory proof = MerkleLib.getProof(leaves, 0);

        vm.prank(alice);
        badges.claim(devCampId, 1, proof);

        vm.prank(owner);
        badges.adminBurn(alice, devCampId, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AlreadyClaimed.selector, devCampId, 1));
        badges.claim(devCampId, 1, proof);
    }

    /// @dev Yakma duraklatma sırasında da çalışmalı — acil durumda yönetici
    ///      önce basımı durdurup sonra temizlik yapabilmeli.
    function test_AdminBurn_WorksWhilePaused() public {
        _backfillAlice(devCampId, 1);

        vm.startPrank(owner);
        badges.pause();
        badges.adminBurn(alice, devCampId, 1);
        vm.stopPrank();

        assertEq(badges.balanceOf(alice, badges.encodeTokenId(devCampId, 1)), 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                   METADATA
    //////////////////////////////////////////////////////////////////////////*/

    function test_InitialURIs() public view {
        assertEq(badges.uri(0), BASE_URI);
        assertEq(badges.contractURI(), CONTRACT_URI);
        assertFalse(badges.isMetadataFrozen());
    }

    /// @dev ERC-1155'te `uri()` tokenId'ye göre DEĞİŞMEZ; şablonu olduğu gibi
    ///      döner ve "{id}" yer tutucusunu istemci değiştirir. Bu sayede yeni
    ///      hafta/kamp eklendiğinde kontrata hiç dokunulmaz.
    function test_URI_IsSameTemplateForAllTokens() public view {
        assertEq(badges.uri(65_539), badges.uri(131_084));
        assertEq(badges.uri(65_539), BASE_URI);
    }

    function test_SetBaseURI() public {
        vm.prank(owner);
        badges.setBaseURI("ipfs://bafyTEST/{id}.json");

        assertEq(badges.uri(0), "ipfs://bafyTEST/{id}.json");
    }

    function test_SetContractURI() public {
        vm.prank(owner);
        badges.setContractURI("ipfs://bafyKOLEKSIYON/collection.json");

        assertEq(badges.contractURI(), "ipfs://bafyKOLEKSIYON/collection.json");
    }

    function test_SetBaseURI_RevertsOnEmpty() public {
        vm.prank(owner);
        vm.expectRevert(EmptyURI.selector);
        badges.setBaseURI("");
    }

    /// @dev İKİ AŞAMALI METADATA PLANININ SON ADIMI:
    ///      IPFS'e taşındıktan sonra dondurulur ve bir daha değişmez.
    function test_FreezeMetadata_IsPermanent() public {
        vm.startPrank(owner);
        badges.setBaseURI("ipfs://bafyFINAL/{id}.json");
        badges.freezeMetadata();

        assertTrue(badges.isMetadataFrozen());

        vm.expectRevert(MetadataIsFrozen.selector);
        badges.setBaseURI("https://saldirgan.example/{id}.json");

        vm.expectRevert(MetadataIsFrozen.selector);
        badges.setContractURI("https://saldirgan.example/collection.json");
        vm.stopPrank();

        assertEq(badges.uri(0), "ipfs://bafyFINAL/{id}.json");
    }

    function test_SetBaseURI_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, attacker)
        );
        badges.setBaseURI("https://saldirgan.example/{id}.json");
    }
}
