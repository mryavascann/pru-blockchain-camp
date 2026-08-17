// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {
    NicknameLengthInvalid,
    NicknameMustStartWithLetter,
    NicknameCannotEndWithUnderscore,
    NicknameHasConsecutiveUnderscores,
    NicknameHasInvalidCharacter,
    NicknameAlreadyTaken,
    NicknameCooldownActive,
    NicknameSameAsCurrent
} from "./PruTypes.sol";

/// @title NicknameRegistry — Cüzdan ↔ nick eşleşmesi
/// @author PRU Blockchain Kulübü
/// @notice Her cüzdanın benzersiz bir görünen adı (nick) olmasını sağlar.
///         Leaderboard ve profil ekranları kimliği bu nick üzerinden gösterir;
///         adres ikincil bilgidir.
///
/// @dev NICK KURALLARI VE GEREKÇELERİ
///
///      Uzunluk        : 3-20 karakter
///      İzinli karakter: a-z, A-Z, 0-9, _
///      İlk karakter   : harf olmalı
///      Son karakter   : alt çizgi olamaz
///      Ardışık "__"   : yasak
///      Benzersizlik   : küçük harfe indirgenmiş hâlin keccak256'sı üzerinden
///      Değiştirme     : serbest, ancak 30 günlük bekleme süresiyle
///
///      TÜRKÇE KARAKTER NEDEN YOK — bu bir güvenlik kararıdır, tembellik değil:
///      Unicode'da "I/ı" ve "İ/i" çiftlerinin büyük-küçük harf dönüşümü
///      locale'e bağlıdır. Türkçe locale'de "I" → "ı", İngilizce locale'de
///      "I" → "i" olur. Zincirde locale diye bir kavram yoktur; bu dönüşümü
///      deterministik yapmak mümkün değildir. Sonuç: "bugra" ve "buğra"
///      leaderboard'da ayırt edilemez hâle gelir ve TAKLİT (impersonation)
///      açığı doğar. Ayrıca çok baytlı UTF-8 karakterlerini zincirde
///      doğrulamak ciddi gas maliyeti demektir.
///
///      ESKİ NICK SERBEST BIRAKILIR: Kullanıcı nickini değiştirdiğinde eski
///      nick başkası tarafından alınabilir hâle gelir. Bu bilinçli bir
///      sadeleştirmedir — tüm zincir kayıtları ADRES bazlıdır, nick yalnızca
///      görüntü katmanıdır.
abstract contract NicknameRegistry is Initializable {
    /*//////////////////////////////////////////////////////////////////////////
                                    OLAYLAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir cüzdana nick atandı veya nick değiştirildi.
    /// @param account     Cüzdan adresi
    /// @param nickname    Yeni nick (kullanıcının yazdığı hâliyle)
    /// @param key         Küçük harfe indirgenmiş hâlin keccak256'sı
    /// @param previous    Önceki nick (ilk kayıtta boş dize)
    event NicknameSet(
        address indexed account, string nickname, bytes32 indexed key, string previous
    );

    /*//////////////////////////////////////////////////////////////////////////
                                   SABİTLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Nick değiştirme bekleme süresi.
    /// @dev Gerekçe: leaderboard'da kimlik istikrarı. Sürekli nick değiştirip
    ///      karışıklık veya taklit yaratmayı engeller. Ücret ALMIYORUZ —
    ///      öğrenci projesi; ayrıca ETH toplamak `withdraw` fonksiyonu ve
    ///      muhasebe yükü getirirdi.
    uint64 public constant NICKNAME_CHANGE_COOLDOWN = 30 days;

    /// @notice İzin verilen en kısa nick uzunluğu.
    uint256 public constant NICKNAME_MIN_LENGTH = 3;

    /// @notice İzin verilen en uzun nick uzunluğu.
    /// @dev 20 karakter tek bir depolama slotuna sığar (kısa string
    ///      optimizasyonu), bu yüzden kayıt maliyeti düşüktür.
    uint256 public constant NICKNAME_MAX_LENGTH = 20;

    /*//////////////////////////////////////////////////////////////////////////
                                    DEPOLAMA
        Upgrade kuralı: sadece sona ekle, __gap'i o kadar azalt.
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev adres => nick (kullanıcının yazdığı hâliyle, görüntüleme için)
    mapping(address account => string nickname) private _nicknames;

    /// @dev normalize edilmiş anahtar => sahibi olan adres
    mapping(bytes32 key => address account) private _nicknameOwners;

    /// @dev adres => mevcut nickinin normalize anahtarı
    ///      (nick değişiminde eski anahtarı serbest bırakmak için tutulur —
    ///      saklamak, her seferinde yeniden hesaplamaktan hem ucuz hem güvenli)
    mapping(address account => bytes32 key) private _nicknameKeys;

    /// @dev adres => son nick atama zamanı (0 = hiç nick almamış)
    mapping(address account => uint64 timestamp) private _nicknameSetAt;

    /// @dev Kullanılan slot: 4  →  50 - 4 = 46
    uint256[46] private __gap;

    /*//////////////////////////////////////////////////////////////////////////
                                 GÖRÜNÜMLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir adresin nickini döner. Nick yoksa boş dize döner.
    function nicknameOf(address account) public view returns (string memory) {
        return _nicknames[account];
    }

    /// @notice Bir adresin nicki var mı?
    /// @dev Rozet almanın ön koşuludur (bkz. `PruCampBadges`).
    function hasNickname(address account) public view returns (bool) {
        return _nicknameSetAt[account] != 0;
    }

    /// @notice Verilen nickin sahibini döner. Sahipsizse sıfır adres döner.
    /// @dev Büyük/küçük harf duyarsızdır: "Bugra" ve "bugra" aynı sonucu verir.
    ///      Nick kurallara uymuyorsa revert eder.
    function ownerOfNickname(string memory nickname) public view returns (address) {
        return _nicknameOwners[_normalizeAndValidate(nickname)];
    }

    /// @notice Bir nickin normalize edilmiş anahtarını üretir.
    /// @dev Doğrulama da yapar; kurallara uymayan nick için revert eder.
    ///      Frontend, kullanıcı yazarken bunu `staticcall` ile çağırıp anında
    ///      geri bildirim verebilir.
    function nicknameKey(string memory nickname) public pure returns (bytes32) {
        return _normalizeAndValidate(nickname);
    }

    /// @notice Normalize anahtarın sahibini döner (yoksa sıfır adres).
    function ownerOfNicknameKey(bytes32 key) public view returns (address) {
        return _nicknameOwners[key];
    }

    /// @notice Bu nick alınabilir mi?
    /// @dev Kurallara uymayan nick için revert eder — yani "false" dönmez,
    ///      hatanın kendisi hangi kuralın çiğnendiğini söyler.
    function isNicknameAvailable(string memory nickname) public view returns (bool) {
        bytes32 key = _normalizeAndValidate(nickname);
        return _nicknameOwners[key] == address(0);
    }

    /// @notice Bir adresin nickini ne zaman değiştirebileceğini döner.
    /// @return Zaman damgası. Hiç nick almamışsa 0 (yani hemen alabilir).
    function nicknameChangeAvailableAt(address account) public view returns (uint64) {
        uint64 setAt = _nicknameSetAt[account];
        if (setAt == 0) return 0;
        return setAt + NICKNAME_CHANGE_COOLDOWN;
    }

    /*//////////////////////////////////////////////////////////////////////////
                              İÇ MANTIK (INTERNAL)
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Nick atar veya değiştirir. Erişim kontrolü çağıranın sorumluluğunda.
    ///
    ///      Not: `account` için sıfır adres kontrolü YOK. Bu fonksiyon yalnızca
    ///      `_msgSender()` ile çağrılıyor ve bir işlemin göndereni hiçbir zaman
    ///      sıfır adres olamaz. Ulaşılamayan bir kontrol eklemek bytecode'u
    ///      büyütür ve test kapsamında asla kapanmayan bir dal bırakır.
    ///      Gelecekte bu fonksiyon farklı bir kaynaktan çağrılacaksa kontrol
    ///      ORADA yapılmalıdır.
    function _setNickname(address account, string memory nickname) internal {
        // 1) Kural doğrulaması + normalizasyon
        bytes32 key = _normalizeAndValidate(nickname);

        // 2) Benzersizlik
        address currentHolder = _nicknameOwners[key];
        if (currentHolder == account) revert NicknameSameAsCurrent();
        if (currentHolder != address(0)) revert NicknameAlreadyTaken(nickname);

        // 3) Bekleme süresi (yalnızca DEĞİŞTİRME için; ilk kayıt serbest)
        uint64 setAt = _nicknameSetAt[account];
        string memory previous = "";

        if (setAt != 0) {
            uint64 availableAt = setAt + NICKNAME_CHANGE_COOLDOWN;
            if (block.timestamp < availableAt) {
                revert NicknameCooldownActive(availableAt);
            }
            // Eski nicki serbest bırak
            previous = _nicknames[account];
            delete _nicknameOwners[_nicknameKeys[account]];
        }

        // 4) Yaz
        _nicknames[account] = nickname;
        _nicknameKeys[account] = key;
        _nicknameOwners[key] = account;
        _nicknameSetAt[account] = uint64(block.timestamp);

        emit NicknameSet(account, nickname, key, previous);
    }

    /// @dev Nicki doğrular ve küçük harfe indirgenmiş hâlinin hash'ini döner.
    ///
    ///      Tek geçişli döngü: her karakteri bir kez okur, hem kural
    ///      kontrolünü hem küçük harfe çevirmeyi aynı adımda yapar.
    ///
    ///      ASCII referansı (onaltılık):
    ///        0x30-0x39 → 0-9
    ///        0x41-0x5A → A-Z
    ///        0x5F      → _
    ///        0x61-0x7A → a-z
    ///      Büyük harften küçük harfe geçiş: +32 (0x20)
    function _normalizeAndValidate(string memory nickname) internal pure returns (bytes32) {
        bytes memory raw = bytes(nickname);
        uint256 len = raw.length;

        if (len < NICKNAME_MIN_LENGTH || len > NICKNAME_MAX_LENGTH) {
            revert NicknameLengthInvalid(len);
        }

        bytes memory lowered = new bytes(len);

        for (uint256 i = 0; i < len; ++i) {
            bytes1 char = raw[i];

            bool isUpper = char >= 0x41 && char <= 0x5A; // A-Z
            bool isLower = char >= 0x61 && char <= 0x7A; // a-z
            bool isDigit = char >= 0x30 && char <= 0x39; // 0-9
            bool isUnderscore = char == 0x5F; // _

            // İzinli karakter kümesi dışı → hangi konumda olduğunu da bildir
            if (!isUpper && !isLower && !isDigit && !isUnderscore) {
                revert NicknameHasInvalidCharacter(i);
            }

            // İlk karakter harf olmalı (rakam/alt çizgi ile başlayamaz)
            if (i == 0 && !isUpper && !isLower) {
                revert NicknameMustStartWithLetter();
            }

            // Son karakter alt çizgi olamaz
            if (i == len - 1 && isUnderscore) {
                revert NicknameCannotEndWithUnderscore();
            }

            // Ardışık alt çizgi yasak
            if (isUnderscore && i > 0 && raw[i - 1] == 0x5F) {
                revert NicknameHasConsecutiveUnderscores();
            }

            // Küçük harfe indirge
            lowered[i] = isUpper ? bytes1(uint8(char) + 32) : char;
        }

        return keccak256(lowered);
    }
}
