// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseTest} from "./Helpers.sol";
import {NicknameRegistry} from "../src/NicknameRegistry.sol";
import {
    NicknameLengthInvalid,
    NicknameMustStartWithLetter,
    NicknameCannotEndWithUnderscore,
    NicknameHasConsecutiveUnderscores,
    NicknameHasInvalidCharacter,
    NicknameAlreadyTaken,
    NicknameCooldownActive,
    NicknameSameAsCurrent
} from "../src/PruTypes.sol";

/// @title Nick kuralları ve benzersizlik testleri
/// @notice Nick, leaderboard'daki kimliktir. Benzersizlikte bir açık,
///         taklit (impersonation) demektir.
contract NicknameTest is BaseTest {
    /*//////////////////////////////////////////////////////////////////////////
                                  KAYIT
    //////////////////////////////////////////////////////////////////////////*/

    function test_Register_Success() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        assertEq(badges.nicknameOf(alice), "bugra");
        assertTrue(badges.hasNickname(alice));
        assertEq(badges.ownerOfNickname("bugra"), alice);
    }

    /// @dev Görüntülenen hâl kullanıcının yazdığı gibi saklanır.
    function test_Register_PreservesDisplayCasing() public {
        vm.prank(alice);
        badges.registerNickname("BugraYavascan");

        assertEq(badges.nicknameOf(alice), "BugraYavascan");
    }

    function test_Register_EmitsEvent() public {
        bytes32 key = badges.nicknameKey("bugra");

        vm.expectEmit(true, true, false, true, address(badges));
        emit NicknameRegistry.NicknameSet(alice, "bugra", key, "");

        vm.prank(alice);
        badges.registerNickname("bugra");
    }

    /*//////////////////////////////////////////////////////////////////////////
                              UZUNLUK KURALLARI
    //////////////////////////////////////////////////////////////////////////*/

    function test_Register_RevertsTooShort() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameLengthInvalid.selector, 2));
        badges.registerNickname("ab");
    }

    function test_Register_RevertsEmpty() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameLengthInvalid.selector, 0));
        badges.registerNickname("");
    }

    function test_Register_RevertsTooLong() public {
        // 21 karakter
        string memory tooLong = "abcdefghijklmnopqrstu";

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameLengthInvalid.selector, 21));
        badges.registerNickname(tooLong);
    }

    function test_Register_AcceptsBoundaryLengths() public {
        vm.prank(alice);
        badges.registerNickname("abc"); // 3 = alt sınır

        vm.prank(bob);
        badges.registerNickname("abcdefghijklmnopqrst"); // 20 = üst sınır

        assertEq(badges.nicknameOf(alice), "abc");
        assertEq(badges.nicknameOf(bob), "abcdefghijklmnopqrst");
    }

    /*//////////////////////////////////////////////////////////////////////////
                             KARAKTER KURALLARI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev TÜRKÇE KARAKTER REDDİ — bu bir güvenlik kuralıdır.
    ///      "buğra" içindeki 'ğ' iki baytlık bir UTF-8 karakterdir (0xC4 0x9F).
    ///      Kontrat dizeyi BAYT bayt tarar, karakter karakter değil; bu yüzden
    ///      hata konumu 2'dir: b(0) u(1) ğ(2-3) r(4) a(5).
    ///
    ///      Bu ayrım frontend için önemli: kullanıcıya "3. karakter geçersiz"
    ///      demek yanlış olur. Hata konumunu doğrudan göstermek yerine
    ///      "Sadece a-z, A-Z, 0-9 ve _ kullanılabilir" mesajı gösterilecek.
    function test_Register_RejectsTurkishCharacters() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameHasInvalidCharacter.selector, 2));
        badges.registerNickname(unicode"buğra");
    }

    /// @dev Türkçe karakterlerin hepsi reddedilmeli.
    function test_Register_RejectsAllTurkishCharacters() public {
        string[6] memory samples = [
            unicode"çınar",
            unicode"gökhan",
            unicode"şule",
            unicode"ümit",
            unicode"İbrahim",
            unicode"ağa_dev"
        ];

        for (uint256 i = 0; i < samples.length; ++i) {
            vm.prank(alice);
            vm.expectRevert();
            badges.registerNickname(samples[i]);
        }

        assertFalse(badges.hasNickname(alice));
    }

    function test_Register_RejectsSpace() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameHasInvalidCharacter.selector, 5));
        badges.registerNickname("bugra yavascan");
    }

    function test_Register_RejectsSpecialCharacters() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameHasInvalidCharacter.selector, 5));
        badges.registerNickname("bugra-dev");
    }

    function test_Register_RejectsEmoji() public {
        vm.prank(alice);
        vm.expectRevert();
        badges.registerNickname(unicode"bugra🚀");
    }

    function test_Register_RevertsStartsWithDigit() public {
        vm.prank(alice);
        vm.expectRevert(NicknameMustStartWithLetter.selector);
        badges.registerNickname("1bugra");
    }

    function test_Register_RevertsStartsWithUnderscore() public {
        vm.prank(alice);
        vm.expectRevert(NicknameMustStartWithLetter.selector);
        badges.registerNickname("_bugra");
    }

    function test_Register_RevertsEndsWithUnderscore() public {
        vm.prank(alice);
        vm.expectRevert(NicknameCannotEndWithUnderscore.selector);
        badges.registerNickname("bugra_");
    }

    function test_Register_RevertsConsecutiveUnderscores() public {
        vm.prank(alice);
        vm.expectRevert(NicknameHasConsecutiveUnderscores.selector);
        badges.registerNickname("bugra__dev");
    }

    function test_Register_AcceptsValidCombinations() public {
        vm.prank(alice);
        badges.registerNickname("bugra_dev_2026");

        vm.prank(bob);
        badges.registerNickname("Web3Ninja");

        vm.prank(carol);
        badges.registerNickname("aB3_x");

        assertEq(badges.nicknameOf(alice), "bugra_dev_2026");
        assertEq(badges.nicknameOf(bob), "Web3Ninja");
        assertEq(badges.nicknameOf(carol), "aB3_x");
    }

    /*//////////////////////////////////////////////////////////////////////////
                                BENZERSİZLİK
    //////////////////////////////////////////////////////////////////////////*/

    function test_Register_RevertsWhenTaken() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(NicknameAlreadyTaken.selector, "bugra"));
        badges.registerNickname("bugra");
    }

    /// @dev EN KRİTİK NICK TESTİ: büyük/küçük harf farkı yeni bir nick yaratmaz.
    ///      Bu olmasaydı "bugra" ve "BUGRA" leaderboard'da iki ayrı satır olur
    ///      ve taklit mümkün hâle gelirdi.
    function test_Register_UniquenessIsCaseInsensitive() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(NicknameAlreadyTaken.selector, "BUGRA"));
        badges.registerNickname("BUGRA");

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(NicknameAlreadyTaken.selector, "BuGrA"));
        badges.registerNickname("BuGrA");
    }

    function test_NicknameKey_IsCaseInsensitive() public view {
        assertEq(badges.nicknameKey("bugra"), badges.nicknameKey("BUGRA"));
        assertEq(badges.nicknameKey("bugra"), badges.nicknameKey("BuGrA"));
        assertTrue(badges.nicknameKey("bugra") != badges.nicknameKey("bugrb"));
    }

    function test_IsNicknameAvailable() public {
        assertTrue(badges.isNicknameAvailable("bugra"));

        vm.prank(alice);
        badges.registerNickname("bugra");

        assertFalse(badges.isNicknameAvailable("bugra"));
        assertFalse(badges.isNicknameAvailable("BUGRA"));
        assertTrue(badges.isNicknameAvailable("baska"));
    }

    /*//////////////////////////////////////////////////////////////////////////
                              DEĞİŞTİRME / COOLDOWN
    //////////////////////////////////////////////////////////////////////////*/

    function test_Change_RevertsDuringCooldown() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        uint64 availableAt = badges.nicknameChangeAvailableAt(alice);
        assertEq(availableAt, uint64(block.timestamp) + 30 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NicknameCooldownActive.selector, availableAt));
        badges.registerNickname("yenibugra");
    }

    function test_Change_SucceedsAfterCooldown() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        badges.registerNickname("yenibugra");

        assertEq(badges.nicknameOf(alice), "yenibugra");
    }

    /// @dev Nick değişince eski nick serbest kalır ve başkası alabilir.
    ///      Bu bilinçli bir sadeleştirme: tüm zincir kayıtları adres bazlı,
    ///      nick yalnızca görüntü katmanı.
    function test_Change_ReleasesOldNickname() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        badges.registerNickname("yenibugra");

        // Eski nick artık sahipsiz
        assertEq(badges.ownerOfNickname("bugra"), address(0));
        assertTrue(badges.isNicknameAvailable("bugra"));

        // Ve başkası alabilir
        vm.prank(bob);
        badges.registerNickname("bugra");
        assertEq(badges.ownerOfNickname("bugra"), bob);
    }

    function test_Change_RevertsWhenSameAsCurrent() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vm.expectRevert(NicknameSameAsCurrent.selector);
        badges.registerNickname("bugra");
    }

    /// @dev Sadece harf büyüklüğünü değiştirmek de aynı nick sayılır.
    function test_Change_RevertsWhenOnlyCasingDiffers() public {
        vm.prank(alice);
        badges.registerNickname("bugra");

        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vm.expectRevert(NicknameSameAsCurrent.selector);
        badges.registerNickname("BUGRA");
    }

    function test_NicknameChangeAvailableAt_ZeroForNewAccount() public view {
        assertEq(badges.nicknameChangeAvailableAt(alice), 0);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                  FUZZING
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Geçerli karakter kümesinden üretilen her nick kabul edilmeli.
    ///      Girdi: 8 karakterlik, harfle başlayan, alt çizgisiz bir dize.
    function testFuzz_ValidNicknamesAreAccepted(uint8[8] calldata seeds) public {
        bytes memory nickname = new bytes(8);
        bytes memory letters = "abcdefghijklmnopqrstuvwxyz";
        bytes memory alnum = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        nickname[0] = letters[seeds[0] % 26];
        for (uint256 i = 1; i < 8; ++i) {
            nickname[i] = alnum[seeds[i] % 62];
        }

        vm.prank(alice);
        badges.registerNickname(string(nickname));

        assertTrue(badges.hasNickname(alice));
        assertEq(badges.nicknameOf(alice), string(nickname));
    }

    /// @dev Rastgele baytlar ya kurallara uyup kabul edilir ya da revert eder;
    ///      hiçbir durumda sessizce bozuk bir kayıt oluşmaz.
    ///      Ayrıca aynı anahtarın iki kez atanamayacağı korunur.
    function testFuzz_RandomBytesNeverCorruptState(bytes calldata raw) public {
        vm.prank(alice);
        try badges.registerNickname(string(raw)) {
            // Kabul edildiyse: kayıt tutarlı olmalı
            bytes32 key = badges.nicknameKey(string(raw));
            assertEq(badges.ownerOfNicknameKey(key), alice);
            assertTrue(badges.hasNickname(alice));

            // Ve aynı nick başkasına verilemez
            vm.prank(bob);
            vm.expectRevert();
            badges.registerNickname(string(raw));
        } catch {
            // Reddedildiyse: hiçbir durum değişmemiş olmalı
            assertFalse(badges.hasNickname(alice));
        }
    }
}
