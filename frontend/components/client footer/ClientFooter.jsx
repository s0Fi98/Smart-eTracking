// components/ClientFooter.jsx
"use client";

import Image from "next/image";
import Link from "next/link";

export default function ClientFooter() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 font-sans print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* 1. Authority Brand & Seal */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-emerald-500 bg-white p-1 shadow-md shrink-0">
                <Image
                  src="/image/Guwahati_Municipal_Corporation_logo.svg.png"
                  alt="GMC Emblem"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 leading-none">
                  Guwahati Municipal Corporation
                </span>
                <span className="text-lg font-black tracking-tight text-white mt-1">
                  Smart Parking
                </span>
              </div>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Official smart municipal parking management infrastructure facilitating digitized check-ins, transparent slab tariffs, and contactless payments across Kamrup Metropolitan.
            </p>
          </div>

          {/* 2. Quick Navigation */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-3.5">
              Portal Links
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-emerald-400 transition-colors">
                  Home / All Standees
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-emerald-400 transition-colors">
                  About Smart Parking
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-emerald-400 transition-colors">
                  Helpdesk & Grievances
                </Link>
              </li>
              <li>
                <Link href="/signin" className="hover:text-emerald-400 transition-colors">
                  Attendant Login
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Approved Tariff Guidelines */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-3.5">
              Approved Base Tariffs
            </h4>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between items-center text-slate-300">
                <span>🚗 Four Wheeler (4W):</span>
                <strong className="text-emerald-400">₹20 / 1 hr</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>🛵 Two Wheeler (2W):</span>
                <strong className="text-emerald-400">₹10 / 1 hr</strong>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 leading-tight">
                No entry ticket fee is applicable upon vehicle check-in. Parking dues are calculated upon exit.
              </p>
            </div>
          </div>

          {/* 4. Municipal Office & Contact */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-3.5">
              Municipal Helpdesk
            </h4>
            <div className="text-xs space-y-2 text-slate-400">
              <p>
                <strong className="text-slate-200 block">Headquarters:</strong>
                Guwahati Municipal Corporation, Panbazar, Guwahati, Assam 781001
              </p>
              <p>
                <strong className="text-slate-200 block">Enforcement / Support:</strong>
                <a href="mailto:support@gmcsmartparking.com" className="hover:text-emerald-400 transition-colors">
                  support@gmcsmartparking.com
                </a>
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Sub-Bar */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>© 2026 Guwahati Municipal Corporation (GMC). All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-[11px] font-mono text-emerald-400/80">
              Status: Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}