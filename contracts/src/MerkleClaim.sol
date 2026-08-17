// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {MerkleRootNotSet, InvalidMerkleProof, AlreadyClaimed} from "./PruTypes.sol";

/// @title MerkleClaim — Hafta bazlı hak ediş doğrulaması
/// @author PRU Blockchain Kulübü
/// @notice Her (kamp, hafta) için ayrı bir merkle root tutar ve kullanıcının
///         sunduğu proof'u bu root'a karşı doğrular.
///
/// @dev MERKLE AĞACI NEDEN VE NASIL
///
///      Bir haftayı 40 kişi tamamladıysa, bu 40 adresi zincire yazmak 40
///      depolama işlemi demektir. Merkle ağacı bunun yerine 40 adresi tek bir
///      32 baytlık özete ("root") sıkıştırır. Zincire sadece bu özet yazılır.
///
///      Kullanıcı rozetini alırken, kendisinin o listede olduğunu kanıtlayan
///      birkaç hash'ten oluşan bir "proof" sunar. Kontrat bu proof'u root ile
///      birleştirip listedeki varlığı doğrular. Liste zincirde durmaz ama
///      zincir listeyi doğrulayabilir.
///
///      Maliyet karşılaştırması:
///        40 adresi zincire yazmak  ≈ 40 × 20.000 gas = 800.000 gas
///        Tek merkle root yazmak    ≈             ~50.000 gas
///
///      YAPRAK (LEAF) FORMATI — çift hash'leme neden?
///
///          leaf = keccak256( keccak256( abi.encode(account, campId, week) ) )
///
///      İçteki hash veriyi sabit 32 bayta indirir. Dıştaki ikinci hash,
///      "ikinci ön görüntü saldırısı" (second preimage attack) denen bir açığı
///      kapatır: tek hash'lense, bir saldırgan ağacın iç düğümlerinden birini
///      yaprak gibi göstererek sahte proof üretebilirdi.
///
///      Bu format `@openzeppelin/merkle-tree` JavaScript kütüphanesinin
///      `StandardMerkleTree.of(values, ["address","uint256","uint256"])`
///      çıktısıyla BİREBİR uyumludur. Backend (Faz 2) ağacı o kütüphaneyle
///      kuracak, kontrat burada doğrulayacak.
///      https://github.com/OpenZeppelin/merkle-tree
///
///      NEDEN campId VE week DE YAPRAĞA GİRİYOR
///      Root zaten (kamp, hafta) bazında ayrı tutuluyor, yani teknik olarak
///      gereksiz. Ama katmanlı savunma: yanlışlıkla bir haftanın root'u başka
///      bir haftaya yazılırsa, proof'lar yine de eşleşmez ve sessiz bir hata
///      yerine açık bir revert alırız.
abstract contract MerkleClaim is Initializable {
    /*//////////////////////////////////////////////////////////////////////////
                                    OLAYLAR
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir (kamp, hafta) için merkle root yazıldı veya güncellendi.
    /// @dev Root GÜNCELLENEBİLİR olmalıdır: listeye sonradan eklenen katılımcı
    ///      olur (geç onaylanan başvuru, itiraz sonucu eklenen kişi vb.).
    ///      Root güncellenince eski proof'lar geçersizleşir, yeni ağaçtan
    ///      üretilen proof'lar geçerli olur. Zaten rozet almış olanlar
    ///      etkilenmez — `_claimedAt` kaydı kalıcıdır.
    event MerkleRootSet(
        uint256 indexed campId, uint256 indexed week, bytes32 oldRoot, bytes32 newRoot
    );

    /*//////////////////////////////////////////////////////////////////////////
                                    DEPOLAMA
        Upgrade kuralı: sadece sona ekle, __gap'i o kadar azalt.
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev campId => week => merkle root
    mapping(uint256 campId => mapping(uint256 week => bytes32 root)) private _merkleRoots;

    /// @dev tokenId => adres => rozetin alındığı zaman damgası (0 = alınmadı)
    ///
    ///      İKİ İŞİ BİRDEN GÖRÜR:
    ///        1. Çift mint engeli — değer 0 değilse tekrar alınamaz.
    ///        2. Burn penceresi   — `claimedAt + 7 gün` sınırını hesaplar.
    ///
    ///      NEDEN ERC-1155 BAKİYESİNE GÜVENMİYORUZ:
    ///      Bakiye kontrolü (`balanceOf == 0`) ücretsiz olurdu, ama rozet
    ///      yakıldığında bakiye sıfıra döner ve kullanıcı aynı proof ile
    ///      rozeti tekrar alabilirdi — yakma işlemi anlamsızlaşırdı. Bu ayrı
    ///      kayıt, yakılan rozetin bir daha alınamamasını garanti eder.
    mapping(uint256 tokenId => mapping(address account => uint64 timestamp)) private _claimedAt;

    /// @dev Kullanılan slot: 2  →  50 - 2 = 48
    uint256[48] private __gap;

    /*//////////////////////////////////////////////////////////////////////////
                                 GÖRÜNÜMLER
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice Bir (kamp, hafta) için yazılmış merkle root'u döner.
    /// @return Root. Henüz yazılmamışsa bytes32(0).
    function merkleRootOf(uint256 campId, uint256 week) public view returns (bytes32) {
        return _merkleRoots[campId][week];
    }

    /// @notice Bir rozetin ne zaman alındığını döner.
    /// @return Zaman damgası. Hiç alınmamışsa 0.
    /// @dev Rozet yakılmış olsa bile bu değer sıfırlanmaz.
    function claimedAt(uint256 tokenId, address account) public view returns (uint64) {
        return _claimedAt[tokenId][account];
    }

    /// @notice Bu rozet daha önce alınmış mı?
    function hasClaimed(uint256 tokenId, address account) public view returns (bool) {
        return _claimedAt[tokenId][account] != 0;
    }

    /// @notice Merkle yaprağını üretir.
    /// @dev Backend'in ürettiği yaprakla birebir aynı olmalıdır. Faz 2'de
    ///      backend testleri bu fonksiyonu referans alacak.
    function merkleLeaf(address account, uint256 campId, uint256 week)
        public
        pure
        returns (bytes32)
    {
        return keccak256(bytes.concat(keccak256(abi.encode(account, campId, week))));
    }

    /// @notice Bir proof'un geçerli olup olmadığını revert etmeden sorgular.
    /// @dev Frontend "Rozeti Al" butonunu aktifleştirmeden önce bunu çağırabilir.
    function isProofValid(
        address account,
        uint256 campId,
        uint256 week,
        bytes32[] calldata proof
    ) public view returns (bool) {
        bytes32 root = _merkleRoots[campId][week];
        if (root == bytes32(0)) return false;
        return MerkleProof.verify(proof, root, merkleLeaf(account, campId, week));
    }

    /*//////////////////////////////////////////////////////////////////////////
                              İÇ MANTIK (INTERNAL)
    //////////////////////////////////////////////////////////////////////////*/

    /// @dev Merkle root yazar/günceller. Erişim kontrolü çağıranın sorumluluğunda.
    function _setMerkleRoot(uint256 campId, uint256 week, bytes32 newRoot) internal {
        bytes32 oldRoot = _merkleRoots[campId][week];
        _merkleRoots[campId][week] = newRoot;
        emit MerkleRootSet(campId, week, oldRoot, newRoot);
    }

    /// @dev Proof'u doğrular ve rozeti "alındı" olarak işaretler.
    ///      Aynı rozet ikinci kez talep edilirse revert eder.
    ///
    ///      SIRALAMA ÖNEMLİ: önce çift-alım kontrolü, sonra root kontrolü,
    ///      en son proof doğrulaması. Böylece kullanıcı en ucuz hatayı en önce
    ///      alır ve gereksiz hash hesabı yapılmaz.
    function _verifyAndMarkClaimed(
        address account,
        uint256 campId,
        uint256 week,
        uint256 tokenId,
        bytes32[] calldata proof
    ) internal {
        if (_claimedAt[tokenId][account] != 0) {
            revert AlreadyClaimed(campId, week);
        }

        bytes32 root = _merkleRoots[campId][week];
        if (root == bytes32(0)) {
            revert MerkleRootNotSet(campId, week);
        }

        bytes32 leaf = merkleLeaf(account, campId, week);
        if (!MerkleProof.verify(proof, root, leaf)) {
            revert InvalidMerkleProof(campId, week);
        }

        _claimedAt[tokenId][account] = uint64(block.timestamp);
    }
}
