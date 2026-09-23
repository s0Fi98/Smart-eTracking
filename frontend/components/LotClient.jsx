// components/LotClient.jsx
"use client";

import { useState } from "react";
import { ACTIVE_TICKETS } from "../lib/mock-data";
import Image from "next/image";
import Link from "next/link";

export default function LotClient({ site }) {
  const [tab, setTab] = useState("ENTRY");

  // Entry Form State
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState("4W");
  const [checkedInAt, setCheckedInAt] = useState(null);

  // Exit Form State
  const [exitPlate, setExitPlate] = useState("");
  const [ticketDetails, setTicketDetails] = useState(null);
  const [calculatedFare, setCalculatedFare] = useState(null);
  const [durationText, setDurationText] = useState("");
  const [exitCleared, setExitCleared] = useState(false);

  // Action: Handle Entry Check-in
  const handleCheckIn = (e) => {
    e.preventDefault();
    if (!vehicleNo.trim()) return;

    const plate = vehicleNo.toUpperCase().trim();
    const newEntry = {
      id: "TKT-" + Math.floor(1000 + Math.random() * 9000),
      vehicleNo: plate,
      vehicleType,
      entryTime: new Date().toISOString(),
      status: "PARKED",
    };

    ACTIVE_TICKETS.push(newEntry);
    setCheckedInAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  // Action: Handle Exit Lookup & Fare Calculation
  const handleCalculateExit = (e) => {
    e.preventDefault();
    const plate = exitPlate.toUpperCase().trim();
    const ticket = ACTIVE_TICKETS.find(
      (t) => t.vehicleNo === plate && t.status === "PARKED"
    );

    if (!ticket) {
      alert("No actively parked vehicle found with this registration number.");
      return;
    }

    const entryDate = new Date(ticket.entryTime);
    const exitDate = new Date();
    const diffMinutes = Math.max(
      Math.floor((exitDate - entryDate) / (1000 * 60)),
      1
    );
    const totalHours = Math.ceil(diffMinutes / 60);

    const slabRate =
      site.rates?.[ticket.vehicleType]?.price ||
      (ticket.vehicleType === "4W" ? 20 : 10);
    const computedTotal = Math.max(
      Math.ceil(totalHours / 2) * slabRate,
      slabRate
    );

    setTicketDetails(ticket);
    setCalculatedFare(computedTotal);
    setDurationText(`${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`);
  };

  // Action: Citizen Confirms Payment
  const handleConfirmExit = () => {
    if (ticketDetails) {
      ticketDetails.status = "EXITED";
      ticketDetails.paidAmount = calculatedFare;
      setExitCleared(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center items-center p-3 sm:p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Verification Header with GMC Emblem */}
        <header className="bg-gradient-to-b from-emerald-800 to-emerald-900 text-white pt-6 pb-5 px-4 text-center relative">
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

          <div className="inline-flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/30 px-3 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Official Parking Portal
          </div>

          <h1 className="text-xl font-black tracking-tight mt-2 text-white">
            {site.name}
          </h1>
          <p className="text-[11px] text-emerald-200/80 font-mono mt-0.5 tracking-wide">
            {site.geoStamp || "26.1804° N, 91.7539° E"}
          </p>
        </header>

        {/* Tab Navigator */}
        <nav className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab("ENTRY");
              setCheckedInAt(null);
            }}
            className={`flex-1 py-3.5 text-center transition-all ${
              tab === "ENTRY"
                ? "text-emerald-700 border-b-2 border-emerald-600 bg-white shadow-sm"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            1. Park Vehicle (Entry)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("EXIT");
              setExitCleared(false);
              setCalculatedFare(null);
            }}
            className={`flex-1 py-3.5 text-center transition-all ${
              tab === "EXIT"
                ? "text-emerald-700 border-b-2 border-emerald-600 bg-white shadow-sm"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            2. Exit & Pay
          </button>
        </nav>

        {/* Main Content Area */}
        <main className="p-5 flex-1 space-y-4">
          {tab === "ENTRY" ? (
            !checkedInAt ? (
              <form onSubmit={handleCheckIn} className="space-y-4">
                {/* 2-Column Site Metadata Matrix */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2 text-xs">
                  {/* Lessee Name Row */}
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-400 text-[11px]">Lessee Name</span>
                    <strong className="text-slate-800 text-right truncate max-w-[180px]">
                      {site.lesseeName || site.leasedTo || site.ticketCollector || "M/S Kalita Enterprise"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Work Order</span>
                      <span className="font-mono text-slate-700 font-semibold">{site.workOrder}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Tenure</span>
                      <span className="font-medium text-slate-700">{site.tenure || "01/01/2026 - 31/12/2026"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Parking Area</span>
                      <span className="font-medium text-slate-700">{site.areaSqft || "5500"} sqft</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Slot Validity</span>
                      <span className="font-medium text-slate-700">{site.slotValidity || "2 hours"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Ticket Collector:</span>
                    <span className="font-medium text-slate-700">{site.ticketCollector || "On-Site Attendant"}</span>
                  </div>

                  <div className="bg-emerald-50 text-emerald-900 p-2 rounded-xl border border-emerald-200/60 flex justify-between items-center text-xs font-bold mt-1">
                    <span className="text-emerald-800 text-[11px]">APPROVED TARIFF</span>
                    <span>4W: ₹20/1h · 2W: ₹10/1h</span>
                  </div>
                </div>

                {/* Vehicle Input */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Vehicle Registration Number
                  </label>
                  <input
                    type="text"
                    placeholder="AS-01-XX-1234"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    className="w-full text-center text-lg font-mono font-black uppercase p-3 border-2 border-slate-300 rounded-2xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    required
                  />
                </div>

                {/* Category Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleType("4W")}
                    className={`py-2.5 text-xs font-bold rounded-xl border-2 transition ${
                      vehicleType === "4W"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    🚗 4-Wheeler
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleType("2W")}
                    className={`py-2.5 text-xs font-bold rounded-xl border-2 transition ${
                      vehicleType === "2W"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    🛵 2-Wheeler
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-700/20 transition duration-150"
                >
                  RECORD ENTRY (NO CHARGE)
                </button>

                <Link
                  href="/image/Adobe Scan 16 Sept 2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-xs font-bold py-3 rounded-2xl border border-slate-200 shadow-xs transition duration-150"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  View Work Order & Tariff Details
                </Link>
              </form>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
                  ✓
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Vehicle Logged Successfully</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Entry ticket recorded into municipal registry</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-1.5 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plate:</span>
                    <strong className="text-slate-900">{vehicleNo}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">In Time:</span>
                    <span className="text-slate-700">{checkedInAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-slate-700">{vehicleType === "4W" ? "4-Wheeler" : "2-Wheeler"}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  Scan this same QR on your return to calculate your duration, settle payment, and exit.
                </p>
              </div>
            )
          ) : !calculatedFare ? (
            <form onSubmit={handleCalculateExit} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter your vehicle registration number to compute total duration and outstanding parking dues.
              </p>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="AS-01-XX-1234"
                  value={exitPlate}
                  onChange={(e) => setExitPlate(e.target.value.toUpperCase())}
                  className="w-full text-center text-lg font-mono font-black uppercase p-3 border-2 border-slate-300 rounded-2xl focus:border-slate-800 outline-none transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl shadow-lg transition duration-150"
              >
                CALCULATE DURATION & FARE
              </button>
            </form>
          ) : !exitCleared ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl text-center shadow-sm">
                <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                  Total Fare Due
                </span>
                <div className="text-3xl font-black text-amber-950 mt-1">
                  ₹ {calculatedFare}.00
                </div>
                <p className="text-xs text-amber-800/90 font-medium mt-1">
                  Parked Duration: {durationText}
                </p>
              </div>

              <div className="bg-slate-50 border border-dashed border-slate-300 p-3.5 rounded-2xl text-center space-y-2">
                <span className="text-[11px] text-slate-600 font-medium block">
                  Direct Lease Settlement (Scan Standee or Tap UPI)
                </span>
                <a
                  href={`upi://pay?pa=brahmaputra@bank&pn=BrahmaputraEnterprises&am=${calculatedFare}&tn=${ticketDetails?.vehicleNo || exitPlate}`}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl shadow transition active:scale-[0.98]"
                >
                  Open UPI App (GPay / PhonePe / Paytm)
                </a>
              </div>

              <button
                type="button"
                onClick={handleConfirmExit}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-700/20 transition"
              >
                I HAVE COMPLETED PAYMENT
              </button>
            </div>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
                ✓
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Exit Cleared</h2>
                <p className="text-xs text-slate-400 mt-0.5">Payment settlement acknowledged</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle:</span>
                  <strong className="font-mono text-slate-900">{ticketDetails?.vehicleNo || exitPlate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <strong className="text-emerald-800">₹ {calculatedFare}.00</strong>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 flex justify-between items-center text-[10px] font-bold text-emerald-700 uppercase">
                  <span>Gate Status:</span>
                  <span className="bg-emerald-200/80 px-2 py-0.5 rounded">Cleared to Exit</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed px-2">
                Show this green clearance pass to the gate marshal on drive out.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}