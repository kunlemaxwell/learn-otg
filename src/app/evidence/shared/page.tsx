"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EvidencePage } from "@/components/EvidencePage";
import { decodeEvidenceLink } from "@/lib/evidence-share";
import type { CompletionEvidence } from "@/lib/evidence-types";
import { useTheme } from "@/lib/theme";
export default function SharedEvidence() {
  const [evidence, setEvidence] = useState<CompletionEvidence>();
  const [error, setError] = useState("");
  useTheme();
  useEffect(() => {
    let revision = 0;
    const read = () => {
      const current = ++revision;
      setError(""); setEvidence(undefined);
      void decodeEvidenceLink(location.hash).then(value => {
        if (current === revision) setEvidence(value);
      }).catch(() => {
        if (current === revision) setError("This learning record link is incomplete or could not be opened. Ask the sender to copy it again.");
      });
    };
    read(); window.addEventListener("hashchange", read);
    return () => { revision++; window.removeEventListener("hashchange", read); };
  }, []);
  return <main className="public-evidence">
    <nav><Link href="/">Learn OTG</Link><span>Shared completion evidence</span></nav>
    {error ? <section className="card" role="alert">{error}</section> : evidence ? <EvidencePage evidence={evidence} /> : <p role="status">Opening learning record…</p>}
  </main>;
}
