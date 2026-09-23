// components/SiteQRGenerator.jsx
"use client";

import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";

export default function SiteQRGenerator({ site, originUrl }) {
  if (!site) return null;

  // Clean URL safe encoding
  const safeId = encodeURIComponent(site.id);
  const targetUrl = `${originUrl}/lot/${safeId}`;

  const handleDownloadCard = () => {
    const svgElement = document.getElementById(`qr-svg-${safeId}`);
    if (!svgElement) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 480;
    const height = 680;
    canvas.width = width;
    canvas.height = height;

    if (!ctx) return;

    // 1. White Card Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Outer Card Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // 3. Badge Pill: "GMC SMART PARKING QR"
    ctx.fillStyle = "#d1fae5";
    const pillW = 280;
    const pillH = 34;
    const pillX = (width - pillW) / 2;
    const pillY = 90;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 17);
    ctx.fill();

    ctx.fillStyle = "#065f46";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GMC SMART PARKING QR", width / 2, pillY + 22);

    // 4. Site Name
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(site.name, width / 2, 160);

    // 5. Site ID
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px monospace";
    ctx.fillText(`ID: ${site.id}`, width / 2, 185);

    // 6. Draw QR Code SVG
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const qrImg = new window.Image();
    qrImg.onload = () => {
      const qrSize = 260;
      const qrX = (width - qrSize) / 2;
      const qrY = 220;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 20);
      ctx.fill();
      ctx.stroke();

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Divider Line
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 540);
      ctx.lineTo(width - 40, 540);
      ctx.stroke();

      // Footer Info
      ctx.textAlign = "left";
      ctx.fillStyle = "#64748b";
      ctx.font = "15px sans-serif";
      ctx.fillText("Capacity:", 40, 575);
      ctx.fillText("Lessee Name:", 40, 615);

      ctx.textAlign = "right";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(`${site.totalCapacity} slots`, width - 40, 575);

      ctx.fillStyle = "#334155";
      ctx.fillText(site.ticketCollector || "Municipal Marshal", width - 40, 615);

      // Logo on Top
      const logoImg = new window.Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, 48, 28, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, width / 2 - 28, 20, 56, 56);
        ctx.restore();

        const a = document.createElement("a");
        a.download = `${site.id}-gmc-qr-card.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        URL.revokeObjectURL(blobURL);
      };

      logoImg.onerror = () => {
        const a = document.createElement("a");
        a.download = `${site.id}-gmc-qr-card.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        URL.revokeObjectURL(blobURL);
      };

      logoImg.src = "/image/Guwahati_Municipal_Corporation_logo.svg.png";
    };

    qrImg.src = blobURL;
  };

  return (
    <div className="bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-md hover:shadow-xl hover:border-emerald-600 transition flex flex-col justify-between text-center break-inside-avoid page-break-inside-avoid">
      
      {/* Target Standee Section */}
      <div className="bg-white p-2 rounded-2xl flex flex-col items-center w-full">
        {/* GMC Circular Emblem */}
        <div className="w-14 h-14 relative rounded-full border border-slate-200 bg-white p-1 shadow-xs mb-2 flex items-center justify-center">
          <Image
            src="/image/Guwahati_Municipal_Corporation_logo.svg.png"
            alt="GMC Emblem"
            width={44}
            height={44}
            className="object-contain"
            priority
          />
        </div>

        {/* Pill Badge */}
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3.5 py-0.5 rounded-full inline-block">
          GMC SMART PARKING QR
        </span>

        {/* Site Name & ID */}
        <h3 className="font-extrabold text-slate-900 text-sm mt-2 line-clamp-1 w-full px-1" title={site.name}>
          {site.name}
        </h3>
        <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[220px]">
          ID: {site.id}
        </p>

        {/* Center QR Box */}
        <div className="my-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-inner">
          <QRCodeSVG
            id={`qr-svg-${safeId}`}
            value={targetUrl}
            size={140}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Bottom Details */}
        <div className="w-full text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-2 text-left">
          <div className="flex justify-between">
            <span>Capacity:</span>
            <strong className="text-slate-800">{site.totalCapacity} slots</strong>
          </div>
          <div className="flex justify-between">
            <span>Lessee Name:</span>
            <strong className="text-slate-700 truncate max-w-[130px]">{site.ticketCollector}</strong>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full mt-3 grid grid-cols-2 gap-2 print:hidden">
        <a
          href={`/lot/${safeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold py-2.5 rounded-xl shadow-xs transition flex items-center justify-center"
        >
          Proceed
        </a>
        <button
          type="button"
          onClick={handleDownloadCard}
          className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold py-2.5 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download QR
        </button>
      </div>

    </div>
  );
}