// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC1155Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {Ownable2StepUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {CampRegistry} from "./CampRegistry.sol";
import {NicknameRegistry} from "./NicknameRegistry.sol";
import {MerkleClaim} from "./MerkleClaim.sol";

import {
    Camp,
    TransfersDisabled,
    ApprovalsDisabled,
    NicknameRequired,
    NothingToBurn,
    BurnWindowExpired,
    EmptyInput,
    ArrayLengthMismatch,
    ZeroAddress,
    MetadataIsFrozen,
    EmptyURI,
    OwnershipRenounceDisabled
} from "./PruTypes.sol";

/// @title PruCampBadges — PRU Blockchain Kulübü haftalık kamp rozetleri
/// @author PRU Blockchain Kulübü
/// @notice Kamp katılımcılarının tamamladıkları her hafta için devredilemez
///         (soulbound) bir başarı rozeti almasını sağlar.
///
/// @dev MİMARİ ÖZET
///
///      ┌─ ERC-1155      : Her (kamp, hafta) bir tokenId. Toplu basım yerleşik.
///      ├─ Soulbound     : mint ve burn dışında tüm transferler engelli.
///      ├─ Merkle        : Hak ediş listesi zincir dışında, doğrulama zincirde.
///      ├─ UUPS proxy    : Bug çıkarsa mantık güncellenir, rozetler yerinde kalır.
///      ├─ Ownable2Step  : Sahiplik devri iki adımlı (yanlış adrese kilitlenme yok).
///      └─ Pausable      : Acil durumda yeni basım durdurulabilir.
///
///      NEDEN ERC-1155, ERC-721 DEĞİL
///      Bu projede rozet TİPİ az (kamp × hafta), rozet SAHİBİ çok. ERC-1155
///      tam olarak bu şekil için tasarlanmıştır ve dört somut kazanç sağlar:
///        1. Toplu basım yerleşik → geri doldurmada 1., 2. ve 3. hafta
///           rozetleri TEK işlemde, tek imzayla, tek gas ödemesiyle alınır.
///        2. Tek URI şablonu → `.../{id}.json` sonsuza kadar sabit; yeni hafta
///           veya yeni kamp eklendiğinde kontrata hiç dokunulmaz.
///        3. `balanceOfBatch` → kullanıcının 15 haftalık ilerlemesi TEK RPC
///           çağrısında okunur (ERC-721'de 15 ayrı çağrı gerekirdi).
///        4. Daha ucuz depolama.
///
///      DÜRÜST DEZAVANTAJ: ERC-5192 (Minimal Soulbound NFT) standardı yalnızca
///      ERC-721 içindir; ERC-1155 için finalize edilmiş bir SBT standardı yok.
///      Bu yüzden `supportsInterface(0xb45a3c0e)` DÖNMÜYORUZ — uymadığımız bir
///      standarda uyuyormuş gibi davranmak yanıltıcı olurdu. Bunun yerine
///      okunabilir bir sinyal olarak `locked()` görünümünü sunuyoruz ve
///      devredilemezliği `_update` içinde kesin olarak zorluyoruz.
///
///      MERKEZİYET UYARISI — bu sistem "trustless" DEĞİLDİR:
///      Sahip (owner) merkle root yazarak kimin rozet alacağını belirler,
///      mantığı güncelleyebilir, basımı durdurabilir ve son 7 gün içinde
///      basılmış bir rozeti yakabilir. Rozetlerin değeri PRU Blockchain
///      Kulübü'nün kurumsal itibarına dayanır. Bu, bir kulüp sertifikası için
///      makul bir modeldir; ama sitede "merkeziyetsiz ve değiştirilemez" diye
///      sunulmamalıdır. Tüm yönetim işlemleri olay (event) yayınlar ve
///      halka açık olarak denetlenebilir.
contract PruCampBadges is
    Initializable,
    ERC1155Upgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    CampRegistry,
    NicknameRegistry,
    MerkleClaim
{
    /*//////////////////////////////////////////////////////////////////////////
                                    OLAYLAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir rozet başarıyla alındı.
    event BadgeClaimed(
        address indexed account, uint256 indexed campId, uint256 indexed week, uint256 tokenId
    );

    /// @notice Yönetici bir rozeti yaktı.
    /// @dev Bu olay halka açık denetim günlüğünün parçasıdır; frontend'de
    ///      "Yönetim İşlemleri" bölümünde gösterilecektir.
    event BadgeBurned(
        address indexed account, uint256 indexed campId, uint256 indexed week, uint256 tokenId
    );

    /// @notice Metadata taban URI'si değiştirildi.
    event BaseURISet(string newURI);

    /// @notice Koleksiyon metadata URI'si değiştirildi.
    event ContractURISet(string newURI);

    /// @notice Metadata kalıcı olarak donduruldu.
    event MetadataFrozen();

    /*//////////////////////////////////////////////////////////////////////////
                                   SABİTLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir rozetin yakılabileceği süre penceresi.
    /// @dev Rozet alındıktan sonra yalnızca 7 gün boyunca yakılabilir.
    ///
    ///      BU SINIR NEDEN KODDA, POLİTİKADA DEĞİL:
    ///      Sınırsız yakma yetkisi, yöneticinin herhangi bir katılımcının
    ///      kazanılmış rozetini istediği an silebilmesi demektir — rozetin
    ///      "başarı kanıtı" değeri tamamen yöneticinin iyi niyetine kalır.
    ///      7 günlük pencere "yanlış basılmış rozeti temizleme" ihtiyacını
    ///      karşılar, ama 8. günden sonra rozeti yönetici dâhil KİMSE
    ///      silemez. Bu bir söz değil, kontratın zorladığı bir kuraldır.
    uint64 public constant BURN_WINDOW = 7 days;

    /*//////////////////////////////////////////////////////////////////////////
                                    DEPOLAMA
        Upgrade kuralı: sadece sona ekle, __gap'i o kadar azalt.
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Koleksiyon seviyesi metadata URI'si (OpenSea koleksiyon kartı için)
    string private _contractURI;

    /// @dev Metadata donduruldu mu? Dondurulduysa URI'ler bir daha değişmez.
    bool private _metadataFrozen;

    /// @dev Kullanılan slot: 2  →  50 - 2 = 48
    uint256[48] private __gap;

    /*//////////////////////////////////////////////////////////////////////////
                              KURULUM (INITIALIZE)
    //////////////////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Implementation kontratının DOĞRUDAN kurulmasını engeller.
        //
        // Proxy modelinde tüm durum (storage) proxy'de tutulur; implementation
        // kontratının kendi storage'ı boştur ve kullanılmamalıdır. Bu satır
        // olmasaydı bir saldırgan implementation'ı doğrudan `initialize`
        // ederek onun sahibi olabilir ve (UUPS'te upgrade mantığı
        // implementation'da olduğu için) `upgradeToAndCall` ile onu
        // `selfdestruct` içeren bir kontrata yönlendirip implementation'ı yok
        // edebilirdi. Bu bilinen bir saldırı sınıfıdır.
        _disableInitializers();
    }

    /// @notice Kontratı kurar. Proxy deploy edilirken bir kez çağrılır.
    /// @param initialOwner Kontratın ilk sahibi
    /// @param baseURI_     Metadata şablonu, "{id}" yer tutucusu KORUNMALI
    ///                     örn: https://prublockchain.vercel.app/api/metadata/{id}.json
    /// @param contractURI_ Koleksiyon metadata URI'si
    function initialize(address initialOwner, string memory baseURI_, string memory contractURI_)
        public
        initializer
    {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (bytes(baseURI_).length == 0) revert EmptyURI();

        __ERC1155_init(baseURI_);
        __Ownable_init(initialOwner);
        __Ownable2Step_init();
        __Pausable_init();
        // Not: `__UUPSUpgradeable_init()` OpenZeppelin v5.7'de kaldırıldı —
        // gövdesi zaten boştu ve UUPS'in kurulum gerektiren bir durumu yok.

        _contractURI = contractURI_;
    }

    /// @notice Kontrat mantığının sürümü.
    /// @dev Upgrade sonrası hangi sürümün aktif olduğunu doğrulamak için.
    ///      Her upgrade'de artırılmalıdır.
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /*//////////////////////////////////////////////////////////////////////////
                            KULLANICI İŞLEMLERİ
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Nick belirler veya değiştirir.
    /// @param nickname 3-20 karakter, a-z A-Z 0-9 _ ; harfle başlar.
    /// @dev İlk kayıt serbesttir; sonraki değişiklikler 30 günlük bekleme
    ///      süresine tabidir.
    function registerNickname(string calldata nickname) external whenNotPaused {
        _setNickname(_msgSender(), nickname);
    }

    /// @notice Tek bir haftanın rozetini alır.
    /// @param campId Kamp kimliği
    /// @param week   Hafta numarası
    /// @param proof  Backend'den alınan merkle proof
    function claim(uint256 campId, uint256 week, bytes32[] calldata proof)
        external
        whenNotPaused
    {
        address account = _msgSender();
        _requireClaimPreconditions(account, campId);
        _requireValidWeek(campId, week);

        uint256 tokenId = encodeTokenId(campId, week);
        _verifyAndMarkClaimed(account, campId, week, tokenId, proof);

        _mint(account, tokenId, 1, "");
        emit BadgeClaimed(account, campId, week, tokenId);
    }

    /// @notice Birden fazla haftanın rozetini TEK işlemde alır.
    /// @param campId      Kamp kimliği
    /// @param weekNumbers Hafta numaraları (örn. [1, 2, 3])
    /// @param proofs      Her haftaya karşılık gelen proof'lar, aynı sırada
    ///
    /// @dev BU FONKSİYON GERİ DOLDURMANIN (BACKFILL) KALBİDİR.
    ///      Kampın 3. haftasında katılan biri 1., 2. ve 3. hafta rozetlerini
    ///      hak eder. Bunları tek tek almak 3 ayrı işlem, 3 ayrı cüzdan onayı
    ///      ve 3 ayrı gas ödemesi demek olurdu. ERC-1155'in `_mintBatch`'i
    ///      sayesinde hepsi tek işlemde, tek onayla, yaklaşık üçte bir
    ///      maliyetle basılır.
    ///
    ///      Her hafta KENDİ merkle root'una karşı ayrı ayrı doğrulanır — toplu
    ///      olması doğrulamayı gevşetmez.
    ///
    ///      Dizide aynı hafta iki kez geçerse ikinci geçiş `AlreadyClaimed`
    ///      ile revert eder (ilk geçiş zaten işaretlemiş olur).
    function claimBatch(
        uint256 campId,
        uint256[] calldata weekNumbers,
        bytes32[][] calldata proofs
    ) external whenNotPaused {
        _claimBatch(_msgSender(), campId, weekNumbers, proofs);
    }

    /// @notice Nick belirler ve rozetleri TEK işlemde alır.
    /// @dev Onboarding kolaylığı: öğrenci iki ayrı cüzdan onayı vermek zorunda
    ///      kalmaz. Yeni katılımcının ilk deneyimi tek tıkla tamamlanır.
    function registerAndClaimBatch(
        string calldata nickname,
        uint256 campId,
        uint256[] calldata weekNumbers,
        bytes32[][] calldata proofs
    ) external whenNotPaused {
        address account = _msgSender();
        _setNickname(account, nickname);
        _claimBatch(account, campId, weekNumbers, proofs);
    }

    /*//////////////////////////////////////////////////////////////////////////
                              YÖNETİCİ İŞLEMLERİ
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Yeni bir kamp oluşturur.
    /// @dev Yeni kamp açmak İÇİN KOD DEĞİŞİKLİĞİ VEYA DEPLOY GEREKMEZ.
    ///      Tek bir işlem yeterlidir.
    function createCamp(string calldata name, uint16 weekCount)
        external
        onlyOwner
        returns (uint256 campId)
    {
        return _createCamp(name, weekCount);
    }

    /// @notice Kampın adını değiştirir.
    /// @dev Metadata'yı backend ürettiği için isim değişikliği BASILMIŞ TÜM
    ///      ROZETLERE anında yansır — ek işlem veya gas gerekmez.
    function setCampName(uint256 campId, string calldata newName) external onlyOwner {
        _setCampName(campId, newName);
    }

    /// @notice Kampın hafta sayısını artırır (15 → 18 gibi).
    /// @dev Azaltma kontrat seviyesinde yasaktır.
    function setCampWeekCount(uint256 campId, uint16 newCount) external onlyOwner {
        _setCampWeekCount(campId, newCount);
    }

    /// @notice Kampı aktif/pasif yapar.
    /// @dev Global `pause`tan farkı: yalnızca bu kampı durdurur, diğer kamplar
    ///      çalışmaya devam eder.
    function setCampActive(uint256 campId, bool active) external onlyOwner {
        _setCampActive(campId, active);
    }

    /// @notice Bir (kamp, hafta) için merkle root yazar veya günceller.
    function setMerkleRoot(uint256 campId, uint256 week, bytes32 root) external onlyOwner {
        _requireValidWeek(campId, week);
        _setMerkleRoot(campId, week, root);
    }

    /// @notice Birden fazla haftanın root'unu tek işlemde yazar.
    /// @dev Geri doldurma sırasında 1..N haftalarının root'ları aynı anda
    ///      yayınlanır; bu fonksiyon o senaryo için.
    function setMerkleRoots(
        uint256 campId,
        uint256[] calldata weekNumbers,
        bytes32[] calldata roots
    ) external onlyOwner {
        uint256 count = weekNumbers.length;
        if (count == 0) revert EmptyInput();
        if (roots.length != count) revert ArrayLengthMismatch(count, roots.length);

        for (uint256 i = 0; i < count; ++i) {
            _requireValidWeek(campId, weekNumbers[i]);
            _setMerkleRoot(campId, weekNumbers[i], roots[i]);
        }
    }

    /// @notice Yanlış basılmış bir rozeti yakar.
    /// @dev SADECE basımdan sonraki 7 gün içinde mümkündür (`BURN_WINDOW`).
    ///
    ///      Yakma KALICIDIR: `_claimedAt` kaydı silinmez, dolayısıyla aynı
    ///      adres o haftanın rozetini bir daha alamaz. Bu bilinçlidir —
    ///      aksi hâlde kullanıcı aynı proof ile hemen yeniden basar ve yakma
    ///      hiçbir işe yaramazdı.
    ///
    ///      Duraklatma (pause) sırasında da çalışır: acil durumda yönetici
    ///      önce basımı durdurup sonra temizlik yapabilmelidir.
    function adminBurn(address account, uint256 campId, uint256 week) external onlyOwner {
        uint256 tokenId = encodeTokenId(campId, week);

        if (balanceOf(account, tokenId) == 0) {
            revert NothingToBurn(account, tokenId);
        }

        uint64 deadline = claimedAt(tokenId, account) + BURN_WINDOW;
        if (block.timestamp > deadline) {
            revert BurnWindowExpired(deadline);
        }

        _burn(account, tokenId, 1);
        emit BadgeBurned(account, campId, week, tokenId);
    }

    /// @notice Yeni rozet basımını durdurur.
    /// @dev Mevcut rozetleri etkilemez; yalnızca `claim*` ve `registerNickname`
    ///      çağrılarını bloklar. `adminBurn` duraklatma sırasında da çalışır.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Basımı yeniden açar.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Metadata taban URI'sini değiştirir.
    /// @param newURI "{id}" yer tutucusunu İÇERMELİDİR.
    /// @dev İKİ AŞAMALI METADATA PLANININ İKİNCİ AŞAMASI BURADAN GEÇER:
    ///      Kamp yapısı oturunca tüm metadata JSON'ları bir IPFS klasörüne
    ///      yüklenir ve buraya `ipfs://<klasörCID>/{id}.json` yazılır. Ardından
    ///      `freezeMetadata()` çağrılır ve rozetler dış sunucudan tamamen
    ///      bağımsız, kalıcı hâle gelir.
    function setBaseURI(string calldata newURI) external onlyOwner {
        if (_metadataFrozen) revert MetadataIsFrozen();
        if (bytes(newURI).length == 0) revert EmptyURI();
        _setURI(newURI);
        emit BaseURISet(newURI);
    }

    /// @notice Koleksiyon metadata URI'sini değiştirir.
    function setContractURI(string calldata newURI) external onlyOwner {
        if (_metadataFrozen) revert MetadataIsFrozen();
        _contractURI = newURI;
        emit ContractURISet(newURI);
    }

    /// @notice Metadata'yı KALICI olarak dondurur.
    /// @dev GERİ ALINAMAZ. Bu çağrıdan sonra `setBaseURI` ve `setContractURI`
    ///      sonsuza kadar revert eder. Yalnızca metadata IPFS'e taşındıktan ve
    ///      doğrulandıktan SONRA çağrılmalıdır.
    function freezeMetadata() external onlyOwner {
        _metadataFrozen = true;
        emit MetadataFrozen();
    }

    /// @notice Sahiplikten feragat DEVRE DIŞI.
    /// @dev Bu kontratta feragat etmek kampı geri dönülemez şekilde öldürür:
    ///      bir daha merkle root yazılamaz, upgrade yapılamaz, duraklatma
    ///      kaldırılamaz. Blok gezgini üzerinden yanlışlıkla tek tıkla
    ///      tetiklenebilecek bu işlem bilinçli olarak kapatıldı.
    ///      Sahiplik devri için `transferOwnership` + `acceptOwnership`.
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    /*//////////////////////////////////////////////////////////////////////////
                        SOULBOUND (DEVREDİLEMEZLİK)
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bu rozet kilitli mi? Her zaman `true`.
    /// @dev ERC-5192'nin `locked()` imzasıyla uyumlu okunabilir bir sinyaldir.
    ///      ERC-5192'nin arayüz kimliğini (0xb45a3c0e) DÖNDÜRMÜYORUZ, çünkü o
    ///      standart ERC-721'e özgüdür ve uymadığımız bir standarda uyuyormuş
    ///      gibi davranmak yanıltıcı olur.
    function locked(uint256) external pure returns (bool) {
        return true;
    }

    /// @notice Onay verme devre dışı.
    /// @dev Transfer zaten engelli olduğu için onay anlamsızdır. Açık bırakmak
    ///      pazaryeri arayüzlerinde "satışa çıkar" gibi çalışmayacak butonlar
    ///      gösterilmesine ve kullanıcının yanılmasına yol açar.
    function setApprovalForAll(address, bool) public pure override {
        revert ApprovalsDisabled();
    }

    /// @notice Hiçbir adres bir başkası adına işlem yapamaz.
    function isApprovedForAll(address, address) public pure override returns (bool) {
        return false;
    }

    /// @dev Tüm bakiye değişiklikleri bu fonksiyondan geçer — devredilemezliği
    ///      burada zorlamak, tek bir transfer yolunu bile açıkta bırakmamayı
    ///      garanti eder.
    ///
    ///        from == 0  →  BASIM (mint)   : serbest
    ///        to   == 0  →  YAKIM (burn)   : serbest
    ///        diğer      →  TRANSFER       : yasak
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabled();
        }
        super._update(from, to, ids, values);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 GÖRÜNÜMLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Koleksiyon seviyesi metadata URI'si (OpenSea standardı).
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /// @notice Metadata dondurulmuş mu?
    function isMetadataFrozen() external view returns (bool) {
        return _metadataFrozen;
    }

    /// @notice Bir kullanıcının bir kamptaki ilerlemesini döner.
    /// @return owned Uzunluğu kampın hafta sayısı kadar olan dizi;
    ///         `owned[i]` true ise (i+1). haftanın rozeti alınmış demektir.
    /// @dev Frontend'deki ilerleme kutucuklarını (■ ■ ■ □ □ …) besler.
    ///      Hafta sayısı VERİDEN gelir — hiçbir yerde "15" sabiti yoktur.
    function progressOf(address account, uint256 campId)
        external
        view
        returns (bool[] memory owned)
    {
        Camp memory camp = getCamp(campId);
        uint256 total = camp.weekCount;
        owned = new bool[](total);

        for (uint256 i = 0; i < total; ++i) {
            uint256 week = i + 1;
            owned[i] = balanceOf(account, encodeTokenId(campId, week)) > 0;
        }
    }

    /// @notice Bir kullanıcının bir kampta kaç rozeti olduğunu döner.
    /// @dev Leaderboard sıralaması bu değere göre yapılır.
    function claimedWeekCount(address account, uint256 campId)
        external
        view
        returns (uint256 count)
    {
        Camp memory camp = getCamp(campId);
        uint256 total = camp.weekCount;

        for (uint256 i = 0; i < total; ++i) {
            if (balanceOf(account, encodeTokenId(campId, i + 1)) > 0) {
                ++count;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////////////////
                              İÇ YARDIMCILAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Rozet almanın ortak ön koşulları.
    ///
    ///      NICK NEDEN ZORUNLU: Leaderboard'un değişmezi "rozeti olan herkesin
    ///      nicki vardır"dır. Bunu kontrat seviyesinde zorlamak, frontend'in
    ///      hiçbir zaman nicksiz bir satır göstermek zorunda kalmamasını
    ///      garanti eder. Tek işlemde halletmek isteyen kullanıcı için
    ///      `registerAndClaimBatch` vardır.
    function _requireClaimPreconditions(address account, uint256 campId) private view {
        _requireCampActive(campId);
        if (!hasNickname(account)) revert NicknameRequired();
    }

    /// @dev Toplu rozet alımının ortak gövdesi.
    function _claimBatch(
        address account,
        uint256 campId,
        uint256[] calldata weekNumbers,
        bytes32[][] calldata proofs
    ) private {
        _requireClaimPreconditions(account, campId);

        uint256 count = weekNumbers.length;
        if (count == 0) revert EmptyInput();
        if (proofs.length != count) revert ArrayLengthMismatch(count, proofs.length);

        uint256[] memory ids = new uint256[](count);
        uint256[] memory amounts = new uint256[](count);

        for (uint256 i = 0; i < count; ++i) {
            uint256 week = weekNumbers[i];
            _requireValidWeek(campId, week);

            uint256 tokenId = encodeTokenId(campId, week);
            // Her hafta KENDİ root'una karşı ayrı doğrulanır.
            // Aynı hafta iki kez geçerse ikincisi AlreadyClaimed ile döner.
            _verifyAndMarkClaimed(account, campId, week, tokenId, proofs[i]);

            ids[i] = tokenId;
            amounts[i] = 1;

            emit BadgeClaimed(account, campId, week, tokenId);
        }

        // Tek `_mintBatch` → tek olay, tek geçiş, ~3 kat daha ucuz.
        _mintBatch(account, ids, amounts, "");
    }

    /// @dev Upgrade yetkisi yalnızca sahibindedir.
    ///
    ///      UYARI: Bu, kontratın en geniş yetkisidir. Bu fonksiyonu
    ///      çağırabilen kişi kontratın TÜM kurallarını değiştirebilir —
    ///      devredilemezliği kaldırabilir, sınırsız rozet basabilir.
    ///      Sahip cüzdanının güvenliği bu yüzden kritiktir.
    ///      Gövde bilerek boştur: tüm yetkilendirme `onlyOwner` değiştiricisiyle
    ///      yapılır ve yeni implementation adresinin geçerliliğini
    ///      `UUPSUpgradeable` zaten doğrular. Parametre adı yazılmaz —
    ///      kullanılmayan bir isim hem derleyici hem statik analiz uyarısı üretir.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
