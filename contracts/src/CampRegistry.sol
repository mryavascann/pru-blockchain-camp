// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {
    Camp,
    CampNotFound,
    CampNotActive,
    CampNameEmpty,
    WeekCountZero,
    WeekCountCannotDecrease,
    WeekOutOfRange,
    InvalidTokenIdInput
} from "./PruTypes.sol";

/// @title CampRegistry — Kamp ve hafta kayıt defteri
/// @author PRU Blockchain Kulübü
/// @notice Kampların zincir üzerindeki tanımını tutar: ad, hafta sayısı,
///         aktiflik durumu. Ayrıca (kamp, hafta) ikilisini tek bir tokenId'ye
///         çeviren kodlamayı barındırır.
///
/// @dev BU MODÜLÜN VAR OLUŞ SEBEBİ — GENİŞLETİLEBİLİRLİK
///
///      Projenin en önemli mimari şartı şuydu: yeni kamp açmak veya mevcut
///      bir kampa hafta eklemek KOD DEĞİŞİKLİĞİ VE YENİDEN DEPLOY
///      GEREKTİRMEMELİ. Bu yüzden kamp sayısı da hafta sayısı da kontratta
///      sabit değildir; ikisi de çalışma anında yazılabilen normal veridir.
///
///        - Yeni kamp  →  `_createCamp(...)`      (tek admin işlemi)
///        - Yeni hafta →  `_setCampWeekCount(...)` (tek admin işlemi)
///
///      Dikkat: bu genişletilebilirlik proxy'den (upgrade) TAMAMEN
///      BAĞIMSIZDIR. Upgrade, kontratın MANTIĞINI değiştirmek içindir;
///      burada yaptığımız ise sadece VERİ yazmaktır. Proxy olmasaydı da
///      kamp/hafta eklemek yine çalışırdı.
abstract contract CampRegistry is Initializable {
    /*//////////////////////////////////////////////////////////////////////////
                                    OLAYLAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Yeni bir kamp oluşturuldu.
    event CampCreated(uint256 indexed campId, string name, uint16 weekCount);

    /// @notice Kampın adı değiştirildi.
    /// @dev Kamp adı metadata'da da görünür; ama metadata'yı backend ürettiği
    ///      için isim değişikliği basılmış tüm rozetlere anında yansır.
    event CampNameUpdated(uint256 indexed campId, string oldName, string newName);

    /// @notice Kampın hafta sayısı artırıldı.
    event CampWeekCountUpdated(uint256 indexed campId, uint16 oldCount, uint16 newCount);

    /// @notice Kampın aktiflik durumu değişti.
    event CampActiveSet(uint256 indexed campId, bool active);

    /*//////////////////////////////////////////////////////////////////////////
                                    DEPOLAMA

        UPGRADE GÜVENLİĞİ KURALI (her modül için geçerli):
        Bu blok yalnızca SONA EKLEME yapılarak değiştirilebilir. Mevcut bir
        değişkenin tipi, sırası veya adı değiştirilemez; arasına yeni değişken
        eklenemez. Yeni bir değişken eklendiğinde `__gap` dizisinin boyutu
        eklenen slot sayısı kadar AZALTILIR ki toplam slot sayısı sabit kalsın.

        Not: OpenZeppelin v5'in upgradeable kontratları ERC-7201 "namespaced
        storage" kullanır ve ardışık slot TÜKETMEZ. Bu yüzden aşağıdaki
        değişkenler slot 0'dan başlar ve düzen tahmin edilebilirdir.
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Oluşturulmuş kamp sayısı. Aynı zamanda son kullanılan campId.
    ///      campId'ler 1'den başlar; 0 "geçersiz kamp" anlamındadır.
    uint256 private _campCount;

    /// @dev campId => kamp kaydı
    mapping(uint256 campId => Camp camp) private _camps;

    /// @dev Gelecekte bu modüle değişken eklenebilmesi için ayrılmış boşluk.
    ///      Kullanılan slot: 2  →  50 - 2 = 48
    uint256[48] private __gap;

    /*//////////////////////////////////////////////////////////////////////////
                            TOKEN ID KODLAMASI
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice (kamp, hafta) ikilisini tek bir ERC-1155 tokenId'sine çevirir.
    /// @param campId Kamp kimliği (1'den başlar)
    /// @param week   Hafta numarası (1'den başlar)
    /// @return tokenId Bit düzeni: üst bitler campId, alt 16 bit hafta.
    ///
    /// @dev NEDEN BÖYLE BİR KODLAMA:
    ///      ERC-1155'te her rozet TİPİ bir tokenId'dir. Eğer tokenId'leri
    ///      1,2,3... diye artan sayaçla üretseydik, hangi tokenId'nin hangi
    ///      kamp/haftaya ait olduğunu tutmak için ayrı bir mapping gerekirdi
    ///      ve her yeni hafta bir depolama yazımı olurdu.
    ///
    ///      Bu kodlamayla tokenId'nin KENDİSİ bilgiyi taşıyor:
    ///        Kamp 1, Hafta 3  →  (1 << 16) | 3  = 65539
    ///        Kamp 2, Hafta 12 →  (2 << 16) | 12 = 131084
    ///
    ///      Sonuç: yeni hafta veya yeni kamp eklendiğinde tokenId üretmek için
    ///      hiçbir depolama işlemi gerekmez, frontend de bit kaydırmayla
    ///      tersine çevirebilir. Metadata URI şablonu (`.../{id}.json`) bu
    ///      sayede sonsuza kadar sabit kalır.
    function encodeTokenId(uint256 campId, uint256 week) public pure returns (uint256) {
        // campId üst 240 bite, week alt 16 bite sığmalı.
        if (campId == 0 || campId > type(uint240).max) {
            revert InvalidTokenIdInput(campId, week);
        }
        if (week == 0 || week > type(uint16).max) {
            revert InvalidTokenIdInput(campId, week);
        }
        return (campId << 16) | week;
    }

    /// @notice tokenId'yi (kamp, hafta) ikilisine geri çevirir.
    /// @dev `encodeTokenId`'nin tersi. Frontend ve indeksleyiciler için.
    function decodeTokenId(uint256 tokenId) public pure returns (uint256 campId, uint256 week) {
        campId = tokenId >> 16;
        week = tokenId & 0xFFFF;
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 GÖRÜNÜMLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Oluşturulmuş toplam kamp sayısı.
    function campCount() public view returns (uint256) {
        return _campCount;
    }

    /// @notice Tek bir kampın kaydını döner.
    /// @dev Kamp yoksa revert eder — sessizce sıfır struct dönmez, çünkü
    ///      "adı boş, 0 haftalık kamp" ile "olmayan kamp" karıştırılmamalı.
    function getCamp(uint256 campId) public view returns (Camp memory) {
        Camp memory camp = _camps[campId];
        if (!camp.exists) revert CampNotFound(campId);
        return camp;
    }

    /// @notice Bir kampın var olup olmadığını revert etmeden sorgular.
    function campExists(uint256 campId) public view returns (bool) {
        return _camps[campId].exists;
    }

    /// @notice Tüm kampları tek çağrıda döner (frontend listeleme için).
    /// @return ids   campId dizisi (1..campCount)
    /// @return items Karşılık gelen kamp kayıtları
    /// @dev Sınırsız döngü uyarısı: kamp sayısı elle oluşturulan, tek haneli
    ///      kalması beklenen bir değerdir. Yine de bu fonksiyon yalnızca
    ///      `view` olduğu için zincir üstü gas riski taşımaz.
    function getAllCamps() public view returns (uint256[] memory ids, Camp[] memory items) {
        uint256 total = _campCount;
        ids = new uint256[](total);
        items = new Camp[](total);
        for (uint256 i = 0; i < total; ++i) {
            uint256 campId = i + 1; // campId'ler 1'den başlar
            ids[i] = campId;
            items[i] = _camps[campId];
        }
    }

    /*//////////////////////////////////////////////////////////////////////////
                              İÇ MANTIK (INTERNAL)

        Bu fonksiyonlar erişim kontrolü İÇERMEZ. Yetkilendirme (onlyOwner)
        somut kontratta (`PruCampBadges`) yapılır. Böylece tüm dış API tek
        dosyada, tek yerde okunabilir olur.
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Yeni kamp oluşturur ve campId döner.
    function _createCamp(string memory name, uint16 weekCount) internal returns (uint256 campId) {
        if (bytes(name).length == 0) revert CampNameEmpty();
        if (weekCount == 0) revert WeekCountZero();

        campId = ++_campCount; // 1'den başlayan artan kimlik

        _camps[campId] =
            Camp({name: name, weekCount: weekCount, active: true, exists: true});

        emit CampCreated(campId, name, weekCount);
    }

    /// @dev Kamp adını günceller.
    function _setCampName(uint256 campId, string memory newName) internal {
        if (bytes(newName).length == 0) revert CampNameEmpty();
        Camp storage camp = _requireCamp(campId);

        string memory oldName = camp.name;
        camp.name = newName;

        emit CampNameUpdated(campId, oldName, newName);
    }

    /// @dev Hafta sayısını artırır.
    ///      AZALTMA YASAK: 15 haftalık bir kampı 10 haftaya düşürmek, 11-15.
    ///      hafta rozetlerini "geçersiz hafta" durumuna sokar; sahipleri
    ///      rozetlerini tutmaya devam eder ama kontrat onları tanımaz hâle
    ///      gelir. Bu tutarsızlığı baştan engelliyoruz.
    function _setCampWeekCount(uint256 campId, uint16 newCount) internal {
        Camp storage camp = _requireCamp(campId);
        uint16 oldCount = camp.weekCount;

        if (newCount == 0) revert WeekCountZero();
        if (newCount < oldCount) revert WeekCountCannotDecrease(oldCount, newCount);

        camp.weekCount = newCount;

        emit CampWeekCountUpdated(campId, oldCount, newCount);
    }

    /// @dev Kampı aktif/pasif yapar.
    ///      Pasif kampta yeni rozet ALINAMAZ, ama mevcut rozetler etkilenmez.
    ///      Bu, global `pause`tan farklıdır: tek bir kampı durdururken
    ///      diğerleri çalışmaya devam eder.
    function _setCampActive(uint256 campId, bool active) internal {
        Camp storage camp = _requireCamp(campId);
        camp.active = active;
        emit CampActiveSet(campId, active);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              DOĞRULAMA YARDIMCILARI
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Kampı storage referansı olarak döner, yoksa revert eder.
    function _requireCamp(uint256 campId) internal view returns (Camp storage camp) {
        camp = _camps[campId];
        if (!camp.exists) revert CampNotFound(campId);
    }

    /// @dev Kamp var VE aktif olmalı.
    function _requireCampActive(uint256 campId) internal view {
        Camp storage camp = _requireCamp(campId);
        if (!camp.active) revert CampNotActive(campId);
    }

    /// @dev Hafta numarası bu kampın geçerli aralığında olmalı.
    function _requireValidWeek(uint256 campId, uint256 week) internal view {
        Camp storage camp = _requireCamp(campId);
        if (week == 0 || week > camp.weekCount) {
            revert WeekOutOfRange(campId, week);
        }
    }
}
