"use client";

import {useState} from "react";

import {Button} from "@/components/ui/Button";

export function SharePortfolio() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return <Button size="sm" variant="secondary" onClick={copy}>{copied ? "Bağlantı kopyalandı ✓" : "Portfolyoyu paylaş"}</Button>;
}

