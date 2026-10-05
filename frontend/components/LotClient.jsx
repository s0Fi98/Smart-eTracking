"use client";
import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const money = (value, currency = "INR") =>
  `${currency} ${(BigInt(value || 0) / 100n).toString()}.${(BigInt(value || 0) % 100n).toString().padStart(2, "0")}`;
async function request(path, body) {
  const response = await fetch(
    `${API}/api/${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        }
      : { signal: AbortSignal.timeout(15000) },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Unable to reach the parking service.");
  return data;
}
export default function LotClient({ site }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [plate, setPlate] = useState(""),
    [plan, setPlan] = useState(""),
    [code, setCode] = useState(""),
    [ticket, setTicket] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let value = new URLSearchParams(location.search).get("token");
        if (!value && site)
          value = (await request("parking/sites")).sites.find(
            (s) => s.id === site.id,
          )?.token;
        if (!value)
          throw new Error(
            "No live QR is available for this location. Open the QR directory or contact staff.",
          );
        if (cancelled) return;
        setToken(value);
        const saved = localStorage.getItem(`parking-ticket:${value}`);
        if (saved) {
          setCode(saved);
          try {
            const restored = await request("parking/ticket", {
              token: value,
              ticketCode: saved,
            });
            if (!cancelled) setTicket(restored.ticket);
            if (restored.ticket.status === "COMPLETED")
              localStorage.removeItem(`parking-entry:${value}`);
          } catch {
            /* Manual lookup remains available. */
          }
        }
        const result = await request(`qr/${encodeURIComponent(value)}`);
        if (!cancelled) {
          setData(result);
          setPlan(String(result.plans[0]?.id || ""));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site]);
  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function entry(e) {
    e.preventDefault();
    run(async () => {
      // Persist the credential before sending, so a network retry cannot duplicate an entry.
      const key = `parking-entry:${token}`;
      const previous = localStorage.getItem(key);
      const ticketCode =
        previous ||
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      localStorage.setItem(key, ticketCode);
      const result = await request("parking/entry", {
        token,
        ticketCode,
        vehicleRegistration: plate,
        pricePlanId: Number(plan),
      });
      localStorage.setItem(`parking-ticket:${token}`, ticketCode);
      setCode(ticketCode);
      setTicket(result.ticket);
    });
  }
  function lookup(e) {
    e.preventDefault();
    run(async () => {
      const result = await request("parking/ticket", {
        token,
        ticketCode: code.trim(),
      });
      setTicket(result.ticket);
      if (result.ticket.status === "COMPLETED")
        localStorage.removeItem(`parking-entry:${token}`);
    });
  }
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-10 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-lg space-y-6">
        <a href="/qrs/" className="text-emerald-700">
          ← Parking QR directory
        </a>
        <header>
          <p className="text-sm text-emerald-700">GMC Smart Parking</p>
          <h1 className="text-2xl font-bold">
            {data?.site.name || site?.name || "Scan & park"}
          </h1>
          <p>{data?.site.address}</p>
        </header>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Loading parking details…</p>}
        {data && (
          <>
            <p>
              Available slots: <strong>{data.slotsAvailable}</strong>
            </p>
            <form onSubmit={entry} className="space-y-4 border-t pt-5">
              <h2 className="text-xl font-semibold">Vehicle entry</h2>
              <label className="block">
                Vehicle registration
                <input
                  required
                  maxLength={30}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="mt-1 block w-full rounded-lg border p-3"
                  placeholder="AS01AB1234"
                />
              </label>
              <label className="block">
                Vehicle and tariff
                <select
                  required
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="mt-1 block w-full rounded-lg border p-3"
                >
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.vehicleType.replaceAll("_", " ")} · {p.name} ·{" "}
                      {money(p.priceMinor, p.currency)} / {p.durationMinutes}{" "}
                      min
                    </option>
                  ))}
                </select>
              </label>
              {data.plans
                .filter((p) => String(p.id) === plan)
                .map((p) => (
                  <p key={p.id} className="text-sm text-slate-600">
                    Grace: {p.graceMinutes} min. Overtime:{" "}
                    {money(p.overtimePriceMinor, p.currency)} per started{" "}
                    {p.overtimeUnitMinutes} min.
                  </p>
                ))}
              <button
                disabled={busy || !plan || ticket?.status === "CHECKED_IN"}
                className="rounded-xl bg-emerald-700 p-3 text-white disabled:opacity-50"
              >
                {busy ? "Please wait…" : "Proceed — record entry"}
              </button>
            </form>
          </>
        )}
        {token && (
          <form onSubmit={lookup} className="space-y-3 border-t pt-5">
            <h2 className="text-xl font-semibold">Exit / payment status</h2>
            <p className="text-sm">
              Use this browser’s saved ticket or paste your private ticket code.
              Keep it private and save it before leaving this page.
            </p>
            <label className="block">
              Private ticket code
              <textarea
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border p-3 font-mono text-xs"
              />
            </label>
            <button
              disabled={busy}
              className="rounded-xl border border-emerald-700 p-3 text-emerald-800 disabled:opacity-50"
            >
              Calculate fare / refresh status
            </button>
          </form>
        )}
        {ticket && (
          <section
            aria-live="polite"
            className="space-y-2 rounded-xl bg-emerald-50 p-5"
          >
            <h2 className="text-xl font-bold">
              {ticket.status === "COMPLETED"
                ? "Payment received — exit cleared"
                : "Entry recorded — pay cash at exit"}
            </h2>
            <p>Ticket: {ticket.reference}</p>
            <p>
              {ticket.vehicleRegistration} · Slot {ticket.slot}
            </p>
            <p>Entry: {new Date(ticket.checkedInAt).toLocaleString()}</p>
            <p className="text-xl font-bold">
              {money(ticket.totalMinor, ticket.currency)}
            </p>
            <p>
              {ticket.status === "COMPLETED"
                ? "Staff confirmed your cash payment. Your slot has been released."
                : "Show this ticket to the collector. Fare continues until staff records payment; refresh after paying to see exit confirmation."}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
