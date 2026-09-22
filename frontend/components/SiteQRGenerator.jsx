"use client";

import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";

export default function SiteQRGenerator({ siteId, siteName, originUrl }) {
  const targetUrl = `${originUrl}/lot/${siteId}`;

  return (
    <div className="max-w-xs mx-auto bg-white p-6 rounded-2xl shadow-xl border-4 border-emerald-700 text-center flex flex-col items-center">
      <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full border border-white/20 p-1.5 mx-auto flex items-center justify-center shadow-md mb-2.5">
        <Image
          src="/image/Guwahati_Municipal_Corporation_logo.svg.png"
          alt="GMC Emblem"
          width={52}
          height={52}
          className="object-contain"
          priority
        />
      </div>
      <span className="text-[8px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
        GMC Smart Parking Solutions
      </span>
      <h3 className="font-extrabold text-slate-900 mt-2 text-lg">{siteName}</h3>
      <p className="text-xs text-slate-500 mb-4">
        Official Municipal Parking Standee
      </p>

      {/* Renders the sharp SVG QR */}
      <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-inner">
        <QRCodeSVG value={targetUrl} size={180} level="H" />
      </div>

      <p className="text-[11px] text-slate-500 mt-4 leading-snug">
        Point camera to verify rates, log parking entry, or pay exit dues.
      </p>
      {/* <code className="text-[10px] text-slate-400 mt-2 break-all">{targetUrl}</code> */}
    </div>
  );
}
