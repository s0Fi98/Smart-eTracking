// app/page.js
"use client";

import { useEffect, useState } from "react";
import SiteQRGenerator from "../components/SiteQRGenerator";
import { SITES_REGISTRY } from "../lib/mock-data";
import Image from "next/image";

export default function HomePage() {
  const [origin, setOrigin] = useState("");
  const [search, setSearch] = useState("");
  const sites = Object.values(SITES_REGISTRY);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.ticketCollector && s.ticketCollector.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      {/* Global Print Fix Style to avoid splitting cards halfway across pages */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          header, .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 print:bg-white print:text-black print:p-2">
        {/* Presentation Header */}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-800 print:border-slate-300">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 relative rounded-full overflow-hidden border-2 border-emerald-500 bg-white p-1 shadow-lg shrink-0">
              <Image
                src="/image/Guwahati_Municipal_Corporation_logo.svg.png"
                alt="GMC Emblem"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] px-3 py-0.5 rounded-full font-bold uppercase tracking-wider print:border-black print:text-black">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse print:hidden"></span>
                Guwahati Municipal Corporation • Smart Parking
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white print:text-black">
                Public Parking Standees
              </h1>
              <p className="text-slate-400 text-xs mt-0.5 print:text-slate-600">
                Entry-View / Exit-Pay Automated Vehicle Architecture
              </p>
            </div>
          </div>

          {/* Search & Print Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto print:hidden">
            <input
              type="text"
              placeholder="Search bay, road, or collector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs px-4 py-3 rounded-xl w-full sm:w-64 focus:outline-none focus:border-emerald-500 transition"
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-5 py-3 rounded-xl shadow transition"
            >
              Print All Standees
            </button>
          </div>
        </div>

        {/* Master Grid of All 40 Standees */}
        <div className="max-w-7xl mx-auto mt-8">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-5 print:hidden">
            <span>
              Displaying <strong>{filteredSites.length}</strong> of 100 Registered Locations
            </span>
            <span className="text-emerald-400 font-mono text-[11px]">
              Target Host: {origin || "Detecting..."}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
            {filteredSites.map((site) => (
              <SiteQRGenerator
                key={site.id}
                site={site}
                originUrl={origin || "http://gmcsmartparking.com"}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}