// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/*//////////////////////////////////////////////////////////////////////////////
    PRU Blockchain Kulübü — Ortak tipler ve hata tanımları

    Bu dosya kontrat içermez. Tüm modüllerin paylaştığı `struct` ve `error`
    tanımları burada toplanır ki:
      - Hata mesajları tek yerden okunabilsin (frontend'de Türkçe karşılık
        yazarken bu dosyaya bakılır),
      - Aynı hata iki modülde farklı isimle tanımlanmasın.

    NEDEN `error` KULLANIYORUZ, `require(..., "mesaj")` DEĞİL:
    Custom error'lar bytecode'da string olarak durmaz, sadece 4 baytlık bir
    seçici (selector) olarak durur. Bu hem kontrat boyutunu küçültür hem de
    revert maliyetini düşürür. Ayrıca parametre taşıyabildikleri için hata
    ayıklaması çok daha kolaydır ("hangi hafta geçersizdi?" sorusunun cevabı
    hatanın içinde gelir).
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Bir kamp programının zincir üzerindeki kaydı.
/// @dev Alan sırası bilinçli: `name` dinamik olduğu için kendi slotunu kullanır,
///      kalan üç alan (uint16 + bool + bool = 4 bayt) tek bir slota paketlenir.
/// @param name       Kampın görünen adı. Sonradan değiştirilebilir
///                   (`setCampName`), çünkü kamplar yeniden adlandırılabilir.
/// @param weekCount  Kampın şu anki hafta sayısı. Sadece ARTIRILABILIR.
/// @param active     Kamp aktif mi? Pasif kampta yeni rozet alınamaz,
///                   ama mevcut rozetler etkilenmez.
/// @param exists     Kamp gerçekten oluşturuldu mu? Var olmayan bir campId
///                   sorgulandığında struct sıfır döner; bu bayrak onu ayırır.
struct Camp {
    string name;
    uint16 weekCount;
    bool active;
    bool exists;
}

/*//////////////////////////////////////////////////////////////////////////////
                            KAMP KAYIT HATALARI
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Böyle bir kamp yok.
error CampNotFound(uint256 campId);

/// @notice Kamp pasif durumda; yeni rozet alınamaz.
error CampNotActive(uint256 campId);

/// @notice Kamp adı boş olamaz.
error CampNameEmpty();

/// @notice Kamp en az 1 haftalık olmalı.
error WeekCountZero();

/// @notice Hafta sayısı azaltılamaz — azaltmak zaten basılmış rozetleri
///         "geçersiz hafta"ya düşürürdü.
error WeekCountCannotDecrease(uint16 current, uint16 requested);

/// @notice İstenen hafta bu kampın aralığında değil (1 <= week <= weekCount).
error WeekOutOfRange(uint256 campId, uint256 week);

/// @notice tokenId kodlaması için geçersiz girdi.
/// @dev campId 1..2^240-1, week 1..65535 aralığında olmalı.
error InvalidTokenIdInput(uint256 campId, uint256 week);

/*//////////////////////////////////////////////////////////////////////////////
                          MERKLE / TALEP HATALARI
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Bu hafta için henüz merkle root yazılmamış — yani hak eden
///         listesi yayınlanmamış.
error MerkleRootNotSet(uint256 campId, uint256 week);

/// @notice Sunulan proof bu hafta için geçerli değil.
/// @dev Frontend'de "Bu hafta için henüz onaylanmamışsın" olarak gösterilir.
error InvalidMerkleProof(uint256 campId, uint256 week);

/// @notice Bu rozet zaten alınmış.
/// @dev Rozet yakılmış (burn) olsa bile bu kayıt silinmez — yakılan bir rozet
///      tekrar alınamaz. Bkz. `PruCampBadges.adminBurn`.
error AlreadyClaimed(uint256 campId, uint256 week);

/*//////////////////////////////////////////////////////////////////////////////
                             NICK HATALARI
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Nick uzunluğu 3-20 karakter aralığında olmalı.
error NicknameLengthInvalid(uint256 length);

/// @notice Nick bir harfle başlamalı (rakam veya alt çizgi ile başlayamaz).
/// @dev Bu kural "0x..." benzeri adres taklidini engeller.
error NicknameMustStartWithLetter();

/// @notice Nick alt çizgi ile bitemez.
error NicknameCannotEndWithUnderscore();

/// @notice Nick içinde art arda iki alt çizgi olamaz.
error NicknameHasConsecutiveUnderscores();

/// @notice Nick'te izin verilmeyen karakter var.
/// @param position Hatalı karakterin sıfır tabanlı konumu.
/// @dev İzinli küme: a-z, A-Z, 0-9, _  — Türkçe karakterler BİLİNÇLİ olarak
///      dışarıda. Gerekçe: İ/i/I/ı çiftinin küçük harfe indirgenmesi
///      locale'e bağlıdır; zincirde deterministik yapılamaz ve leaderboard'da
///      taklit (impersonation) açığı yaratır.
error NicknameHasInvalidCharacter(uint256 position);

/// @notice Bu nick başkası tarafından alınmış.
/// @dev Karşılaştırma küçük harfe indirgenmiş hâl üzerinden yapılır:
///      "Bugra", "BUGRA" ve "bugra" aynı nick sayılır.
error NicknameAlreadyTaken(string nickname);

/// @notice Nick değiştirme bekleme süresi dolmadı.
/// @param availableAt Değiştirmenin serbest kalacağı zaman damgası.
error NicknameCooldownActive(uint64 availableAt);

/// @notice Yeni nick mevcut nick ile aynı.
error NicknameSameAsCurrent();

/// @notice Rozet almak için önce nick belirlenmeli.
/// @dev Bu kural leaderboard'un değişmezidir: rozeti olan herkesin nick'i vardır.
error NicknameRequired();

/*//////////////////////////////////////////////////////////////////////////////
                        SOULBOUND (DEVREDİLEMEZLİK)
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Rozetler devredilemez. Sadece mint (basım) ve burn (yakım) serbest.
error TransfersDisabled();

/// @notice Onay (approval) fonksiyonları devre dışı.
/// @dev Transfer zaten engelli olduğu için onay vermek anlamsız; açık bırakmak
///      kullanıcıyı "rozetimi satabilirim" yanılgısına düşürür ve pazaryeri
///      arayüzlerinde yanıltıcı butonlar gösterilmesine yol açar.
error ApprovalsDisabled();

/*//////////////////////////////////////////////////////////////////////////////
                             BURN HATALARI
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Yakılacak rozet yok (hiç alınmamış veya zaten yakılmış).
error NothingToBurn(address account, uint256 tokenId);

/// @notice Yakma penceresi kapandı.
/// @param deadline Yakmanın mümkün olduğu son zaman damgası.
/// @dev Rozet alındıktan sonra sadece 7 gün boyunca yakılabilir. Bu sınır
///      kontrat seviyesinde zorlanır — söz değil, koddur. Amacı: "yanlış
///      basılmış rozeti temizleme" ihtiyacını karşılarken, eski rozetleri
///      admin dâhil kimsenin silemeyeceği hâle getirmek.
error BurnWindowExpired(uint64 deadline);

/*//////////////////////////////////////////////////////////////////////////////
                           GENEL / GİRDİ HATALARI
//////////////////////////////////////////////////////////////////////////////*/

/// @notice Boş dizi gönderildi.
error EmptyInput();

/// @notice Birlikte gönderilen dizilerin uzunlukları eşleşmiyor.
error ArrayLengthMismatch(uint256 lengthA, uint256 lengthB);

/// @notice Sıfır adres kabul edilmiyor.
error ZeroAddress();

/// @notice Metadata dondurulmuş; URI artık değiştirilemez.
error MetadataIsFrozen();

/// @notice URI boş olamaz.
error EmptyURI();

/// @notice Sahiplikten feragat devre dışı bırakıldı.
/// @dev Gerekçe: UUPS proxy + merkle root mimarisinde sahiplikten feragat
///      etmek kampı geri dönülemez şekilde öldürür (artık ne root yazılabilir,
///      ne upgrade yapılabilir, ne pause kaldırılabilir). Blok gezgini
///      üzerinden yanlışlıkla tek tıkla tetiklenebilecek bu işlem kapatıldı.
///      Sahiplik devri için `transferOwnership` + `acceptOwnership` kullanılır.
error OwnershipRenounceDisabled();
