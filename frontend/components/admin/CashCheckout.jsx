"use client";
import { useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
export default function CashCheckout({ reference, onComplete }) {
  const [quote, setQuote] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function call(collect) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/admin/cash/${encodeURIComponent(reference)}`,
        {
          credentials: "include",
          ...(collect
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amountMinor: quote.totalMinor }),
              }
            : {}),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setQuote(result.ticket);
      if (collect) onComplete();
    } catch (e) {
      setError(e.message);
      setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button disabled={busy} onClick={() => call(false)}>
        Cash checkout
      </button>
      {quote && (
        <div>
          <p>
            Collect {quote.currency}{" "}
            {(BigInt(quote.totalMinor) / 100n).toString()}.
            {(BigInt(quote.totalMinor) % 100n).toString().padStart(2, "0")} cash
            for {quote.vehicleRegistration}.
          </p>
          <button disabled={busy} onClick={() => call(true)}>
            Confirm cash received &amp; release slot
          </button>
          <button onClick={() => setQuote(null)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
