// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {PruCampBadges} from "../src/PruCampBadges.sol";

/// @title MerkleLib — Testler için merkle ağacı kurucusu
/// @notice Testlerde hak ediş listesi oluşturup proof üretmek için kullanılır.
///
/// @dev NEDEN KENDİ KÜTÜPHANEMİZİ YAZIYORUZ:
///      Üretimde ağacı backend `@openzeppelin/merkle-tree` (JavaScript) ile
///      kuracak. Kontrat ise yalnızca DOĞRULAMA yapıyor ve OpenZeppelin'in
///      `MerkleProof.verify` fonksiyonunu kullanıyor. Bu doğrulayıcı, kardeş
///      düğümleri hash'lemeden önce SIRALAYAN her ağaç kurulumuyla uyumludur —
///      ağacın nasıl inşa edildiğinden bağımsızdır.
///
///      Bu yüzden testte harici bir bağımlılık (murky vb.) eklemek yerine
///      ~40 satırlık kendi kurucumuzu yazmak hem daha az bağımlılık hem de
///      ne olup bittiğinin okunabilir olması demek.
///
///      Faz 2'de backend'in ürettiği ağaçla bu kütüphanenin ürettiği ağacın
///      aynı root'u verdiğini doğrulayan bir çapraz test eklenecek.
library MerkleLib {
    /// @dev İki düğümü sıralayarak hash'ler.
    ///      Sıralama şart: OpenZeppelin'in `MerkleProof` doğrulayıcısı
    ///      kardeşlerin hangi tarafta olduğunu proof'ta taşımaz, bunun yerine
    ///      her adımda küçük olanı sola koyar. Kurucu da aynısını yapmalı.
    function hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    /// @dev Bir seviyeyi bir üst seviyeye indirger.
    ///      Düğüm sayısı tekse son düğüm eşsiz kalır ve olduğu gibi yukarı
    ///      taşınır (kendisiyle hash'lenmez — bu yaygın bir hata kaynağıdır).
    function nextLevel(bytes32[] memory nodes) internal pure returns (bytes32[] memory out) {
        uint256 count = nodes.length;
        uint256 parentCount = (count + 1) / 2;
        out = new bytes32[](parentCount);

        for (uint256 i = 0; i < parentCount; ++i) {
            uint256 left = 2 * i;
            uint256 right = left + 1;
            out[i] = right < count ? hashPair(nodes[left], nodes[right]) : nodes[left];
        }
    }

    /// @dev Yapraklardan kök (root) hesaplar.
    function getRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        require(leaves.length > 0, "MerkleLib: bos yaprak listesi");

        bytes32[] memory level = leaves;
        while (level.length > 1) {
            level = nextLevel(level);
        }
        return level[0];
    }

    /// @dev Belirli bir yaprak için proof üretir.
    function getProof(bytes32[] memory leaves, uint256 index)
        internal
        pure
        returns (bytes32[] memory proof)
    {
        require(index < leaves.length, "MerkleLib: gecersiz indeks");

        // Ağaç derinliği pratikte 32'yi geçmez (2^32 yaprak).
        bytes32[] memory buffer = new bytes32[](32);
        uint256 count = 0;

        bytes32[] memory level = leaves;
        uint256 idx = index;

        while (level.length > 1) {
            uint256 sibling = idx ^ 1; // çift ise sağdaki, tek ise soldaki
            // Kardeşi yoksa (tek sayıda düğüm, son eleman) proof'a bir şey
            // eklenmez — düğüm olduğu gibi yukarı taşınmıştı.
            if (sibling < level.length) {
                buffer[count] = level[sibling];
                ++count;
            }
            level = nextLevel(level);
            idx = idx / 2;
        }

        proof = new bytes32[](count);
        for (uint256 i = 0; i < count; ++i) {
            proof[i] = buffer[i];
        }
    }
}

/// @title BaseTest — Tüm test dosyalarının ortak kurulum tabanı
/// @notice Proxy arkasında kurulmuş bir `PruCampBadges` örneği, sabit test
///         adresleri ve merkle yardımcıları sağlar.
///
/// @dev KURULUM ÜRETİMLE AYNI ŞEKİLDE YAPILIR:
///      Testler kontratı doğrudan `new PruCampBadges()` ile kullanmaz;
///      gerçekte olduğu gibi implementation + ERC1967Proxy ikilisi kurulur ve
///      tüm çağrılar proxy üzerinden gider. Böylece proxy'ye özgü hatalar
///      (initializer'ın çalışmaması, storage çakışması vb.) testlerde yakalanır.
abstract contract BaseTest is Test {
    /*//////////////////////////////////////////////////////////////////////////
                                  KONTRATLAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Kullanıcıların konuştuğu adres (proxy).
    PruCampBadges internal badges;

    /// @dev Mantığın bulunduğu adres. Doğrudan kullanılmaz, upgrade testlerinde
    ///      referans olarak gerekir.
    PruCampBadges internal implementation;

    /*//////////////////////////////////////////////////////////////////////////
                                   ADRESLER
    //////////////////////////////////////////////////////////////////////////*/

    address internal owner = makeAddr("owner");
    address internal newOwner = makeAddr("newOwner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal attacker = makeAddr("attacker");

    /*//////////////////////////////////////////////////////////////////////////
                                    SABİTLER
    //////////////////////////////////////////////////////////////////////////*/

    string internal constant BASE_URI =
        "https://prublockchain.vercel.app/api/metadata/{id}.json";
    string internal constant CONTRACT_URI =
        "https://prublockchain.vercel.app/api/collection.json";

    string internal constant DEV_CAMP_NAME = "PRU Blockchain Developers";
    string internal constant DIR_CAMP_NAME = "PRU Blockchain Directors";

    uint16 internal constant DEV_WEEKS = 15;
    uint16 internal constant DIR_WEEKS = 12;

    /// @dev setUp içinde oluşturulan kampların kimlikleri.
    uint256 internal devCampId;
    uint256 internal dirCampId;

    /*//////////////////////////////////////////////////////////////////////////
                                    KURULUM
    //////////////////////////////////////////////////////////////////////////*/

    function setUp() public virtual {
        implementation = new PruCampBadges();

        bytes memory initData =
            abi.encodeCall(PruCampBadges.initialize, (owner, BASE_URI, CONTRACT_URI));

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        badges = PruCampBadges(address(proxy));

        // İki gerçek kampı oluştur — testlerin çoğu bunları kullanır.
        vm.startPrank(owner);
        devCampId = badges.createCamp(DEV_CAMP_NAME, DEV_WEEKS);
        dirCampId = badges.createCamp(DIR_CAMP_NAME, DIR_WEEKS);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////////////////
                            MERKLE YARDIMCILARI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Verilen adresler için bir haftanın root'unu hesaplar ve zincire yazar.
    /// @return leaves Yapraklar — proof üretmek için saklanmalı.
    function _publishRoot(uint256 campId, uint256 week, address[] memory accounts)
        internal
        returns (bytes32[] memory leaves)
    {
        leaves = new bytes32[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            leaves[i] = badges.merkleLeaf(accounts[i], campId, week);
        }

        vm.prank(owner);
        badges.setMerkleRoot(campId, week, MerkleLib.getRoot(leaves));
    }

    /// @dev `fromWeek`..`toWeek` aralığındaki her hafta için aynı katılımcı
    ///      listesiyle root yayınlar. Geri doldurma senaryosunu kurar.
    /// @return leavesPerWeek leavesPerWeek[i] → (fromWeek + i). haftanın yaprakları
    function _publishWeekRange(
        uint256 campId,
        uint256 fromWeek,
        uint256 toWeek,
        address[] memory accounts
    ) internal returns (bytes32[][] memory leavesPerWeek) {
        uint256 total = toWeek - fromWeek + 1;
        leavesPerWeek = new bytes32[][](total);

        for (uint256 i = 0; i < total; ++i) {
            leavesPerWeek[i] = _publishRoot(campId, fromWeek + i, accounts);
        }
    }

    /// @dev Bir hafta aralığı için belirli bir katılımcının proof dizisini üretir.
    function _proofsFor(bytes32[][] memory leavesPerWeek, uint256 accountIndex)
        internal
        pure
        returns (bytes32[][] memory proofs)
    {
        proofs = new bytes32[][](leavesPerWeek.length);
        for (uint256 i = 0; i < leavesPerWeek.length; ++i) {
            proofs[i] = MerkleLib.getProof(leavesPerWeek[i], accountIndex);
        }
    }

    /*//////////////////////////////////////////////////////////////////////////
                              DİZİ YARDIMCILARI
    //////////////////////////////////////////////////////////////////////////*/

    function _addresses(address a) internal pure returns (address[] memory out) {
        out = new address[](1);
        out[0] = a;
    }

    function _addresses(address a, address b) internal pure returns (address[] memory out) {
        out = new address[](2);
        out[0] = a;
        out[1] = b;
    }

    function _addresses(address a, address b, address c)
        internal
        pure
        returns (address[] memory out)
    {
        out = new address[](3);
        out[0] = a;
        out[1] = b;
        out[2] = c;
    }

    /// @dev `from`..`to` aralığını içeren artan sayı dizisi üretir.
    function _range(uint256 from, uint256 to) internal pure returns (uint256[] memory out) {
        uint256 total = to - from + 1;
        out = new uint256[](total);
        for (uint256 i = 0; i < total; ++i) {
            out[i] = from + i;
        }
    }

    function _uints(uint256 a) internal pure returns (uint256[] memory out) {
        out = new uint256[](1);
        out[0] = a;
    }

    /*//////////////////////////////////////////////////////////////////////////
                             SENARYO YARDIMCILARI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Bir adrese nick verir.
    function _giveNickname(address account, string memory nickname) internal {
        vm.prank(account);
        badges.registerNickname(nickname);
    }

    /// @dev Tam bir "geri doldurma" senaryosu kurar:
    ///      alice'e nick verir, 1..`throughWeek` haftalarını yayınlar ve
    ///      alice'in rozetlerini almasını sağlar.
    function _backfillAlice(uint256 campId, uint256 throughWeek) internal {
        _giveNickname(alice, "alice");

        address[] memory participants = _addresses(alice, bob);
        bytes32[][] memory leavesPerWeek = _publishWeekRange(campId, 1, throughWeek, participants);

        vm.prank(alice);
        badges.claimBatch(campId, _range(1, throughWeek), _proofsFor(leavesPerWeek, 0));
    }
}
