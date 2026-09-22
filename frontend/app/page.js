"use client";

import { useEffect, useState } from "react";
import SiteQRGenerator from "../components/SiteQRGenerator";
import { SITES_REGISTRY } from "../lib/mock-data";
import Link from "next/link";

export default function HomePage() {
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const site = SITES_REGISTRY["fancy-bazar-04"];

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-black text-emerald-400">Smart Parking Solutions</h1>
        <p className="text-sm text-slate-400 mt-1">
          Scan this QR with your mobile camera to check the live citizen portal.
        </p>
      </div>

      <SiteQRGenerator
        siteId={site.id}
        siteName={site.name}
        originUrl={origin}
      />

      <div className="pt-2">
        <Link
          href={`/lot/${site.id}`}
          className="text-xs text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
        >
          Direct Mobile Test Link (/lot/{site.id})
        </Link>
      </div>
    </main>
  );
}