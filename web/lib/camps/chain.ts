/**
 * Veritabanı kamp kimliği ile kontrat kamp kimliğini bilinçli olarak ayırır.
 * Yeni eğitmen kampı taslakken zincirde karşılığı olmadığı için null döner.
 */
export function chainCampIdOf(camp: {
  id: number;
  chainCampId: number | null;
  ownerAddress?: string | null;
}): number | null {
  if (camp.chainCampId !== null) return camp.chainCampId;

  // Geçiş güvenliği: migration henüz uygulanmamış eski çekirdek kamplarda
  // DB id'si tarihsel olarak zincir id'siyle birebir aynıydı.
  return camp.ownerAddress == null ? camp.id : null;
}

