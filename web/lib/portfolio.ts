import "server-only";

import {cache} from "react";
import {zeroAddress} from "viem";

import {readNickname, readNicknameOwner, readProgress} from "@/lib/chain/client";
import {checkNickname, normalizeNickname} from "@/lib/nickname";
import {db} from "@/lib/db";

export type PublicPortfolioCamp = {
  slug: string;
  name: string;
  instructorName: string | null;
  weekCount: number;
  currentWeek: number;
  completed: boolean;
  earnedBadges: number;
  progress: boolean[];
};

export type PublicPortfolio = {
  nickname: string;
  maskedAddress: string;
  totalBadges: number;
  completedCampCount: number;
  noteCount: number;
  camps: PublicPortfolioCamp[];
};

/** Nick dışında kişisel profil alanı döndürmeyen herkese açık DTO. */
export const getPublicPortfolio = cache(async (rawNickname: string): Promise<PublicPortfolio | null> => {
  const checked = checkNickname(rawNickname);
  if (!checked.valid) return null;

  let address: `0x${string}`;
  try {
    address = await readNicknameOwner(normalizeNickname(rawNickname));
  } catch {
    return null;
  }
  if (address.toLowerCase() === zeroAddress) return null;

  const normalizedAddress = address.toLowerCase();
  const [nickname, camps, completions, applications, noteCount] = await Promise.all([
    readNickname(address).catch(() => rawNickname),
    db.camp.findMany({
      where: {lifecycle: "PUBLISHED"},
      orderBy: {displayOrder: "asc"},
      select: {
        id: true,
        chainCampId: true,
        slug: true,
        name: true,
        instructorName: true,
        weekCount: true,
      },
    }),
    db.weeklyCompletion.findMany({
      where: {address: normalizedAddress},
      select: {campId: true, weekNumber: true},
    }),
    db.application.findMany({
      where: {address: normalizedAddress, status: "APPROVED"},
      select: {campId: true, declaredWeek: true},
    }),
    db.weekNote.count({where: {address: normalizedAddress, status: "VISIBLE"}}),
  ]);

  const completionMap = new Map<number, number[]>();
  for (const completion of completions) {
    const values = completionMap.get(completion.campId) ?? [];
    values.push(completion.weekNumber);
    completionMap.set(completion.campId, values);
  }
  const applicationMap = new Map(applications.map((application) => [application.campId, application]));

  const portfolioCamps = (
    await Promise.all(
      camps.map(async (camp): Promise<PublicPortfolioCamp | null> => {
        const dbWeeks = completionMap.get(camp.id) ?? [];
        const application = applicationMap.get(camp.id);
        if (!application && dbWeeks.length === 0) return null;

        const onChain = camp.chainCampId
          ? await readProgress(address, camp.chainCampId, camp.weekCount).catch(
              () => new Array(camp.weekCount).fill(false) as boolean[],
            )
          : (new Array(camp.weekCount).fill(false) as boolean[]);
        const dbProgress = new Set(dbWeeks);
        const progress = Array.from(
          {length: camp.weekCount},
          (_, index) => onChain[index] || dbProgress.has(index + 1),
        );
        const currentWeek = Math.min(
          camp.weekCount,
          Math.max(application?.declaredWeek ?? 0, ...dbWeeks, 0),
        );

        return {
          slug: camp.slug,
          name: camp.name,
          instructorName: camp.instructorName,
          weekCount: camp.weekCount,
          currentWeek,
          completed: currentWeek >= camp.weekCount,
          earnedBadges: onChain.filter(Boolean).length,
          progress,
        };
      }),
    )
  ).filter((camp): camp is PublicPortfolioCamp => camp !== null);

  return {
    nickname,
    maskedAddress: `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}`,
    totalBadges: portfolioCamps.reduce((sum, camp) => sum + camp.earnedBadges, 0),
    completedCampCount: portfolioCamps.filter((camp) => camp.completed).length,
    noteCount,
    camps: portfolioCamps,
  };
});
