"use client";

import {useRouter} from "next/navigation";
import {useState, type FormEvent} from "react";

import {Button} from "@/components/ui/Button";
import {checkNickname} from "@/lib/nickname";

export function PortfolioSearch({compact = false}: {compact?: boolean}) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = nickname.trim();
    const checked = checkNickname(value);
    if (!checked.valid) {
      setError(checked.reason);
      return;
    }
    setError(null);
    router.push(`/profil/${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={submit}>
      {!compact && <label htmlFor="portfolio-nick" className="mb-2 block text-sm font-semibold">Katılımcı nicki</label>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="portfolio-nick" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="ör. bugra_dev" autoComplete="off" className="input min-w-0 flex-1" aria-label={compact ? "Katılımcı nicki" : undefined} />
        <Button type="submit" variant="accent">Portfolyoyu gör →</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
