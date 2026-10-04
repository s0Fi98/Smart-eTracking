"use client";
import { useEffect, useState } from "react";
export default function ScanPage() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token");
    if (!token) {
      setError(
        "This link is missing a QR token. Please scan a parking site QR code.",
      );
      return;
    }
    if (token.startsWith("demo-")) {
      setError(
        "This is a demo preview QR code. It is not a live parking site.",
      );
      return;
    }
    const controller = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/qr/${encodeURIComponent(token)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message || "This QR code is no longer available.",
          );
        setData(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            e.message === "Failed to fetch"
              ? "Unable to reach the parking service. Please try again later."
              : e.message,
          );
      });
    return () => controller.abort();
  }, []);
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f8f3",
        color: "#233d35",
        fontFamily: "var(--font-geist-sans), sans-serif",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 650, margin: "auto" }}>
        <a href="/" style={{ fontWeight: 600 }}>
          GMC Smart Parking
        </a>
        {error ? (
          <section role="alert" style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: 28 }}>QR code unavailable</h1>
            <p style={{ marginTop: 15 }}>{error}</p>
          </section>
        ) : !data ? (
          <p role="status" style={{ marginTop: 40 }}>
            Finding this parking area…
          </p>
        ) : (
          <section style={{ marginTop: 40 }}>
            <p
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Parking area
            </p>
            <h1 style={{ fontSize: 36, fontWeight: 550, margin: "12px 0" }}>
              {data.site.name}
            </h1>
            <p>{data.site.address}</p>
            <p style={{ margin: "20px 0" }}>
              Available slots: <b>{data.slotsAvailable}</b> ·{" "}
              {data.site.timezone}
            </p>
            <h2 style={{ fontSize: 21, marginTop: 30 }}>Parking rates</h2>
            {data.plans.length ? (
              data.plans.map((plan, i) => (
                <div
                  key={i}
                  style={{
                    padding: "18px 0",
                    borderBottom: "1px solid #dfe4dd",
                  }}
                >
                  <b>{plan.name}</b>
                  <p>
                    {plan.vehicleType.replaceAll("_", " ")} ·{" "}
                    {plan.durationMinutes} minutes
                  </p>
                  <p>
                    {plan.currency}{" "}
                    {(BigInt(plan.priceMinor) / 100n).toString()}.
                    {(BigInt(plan.priceMinor) % 100n)
                      .toString()
                      .padStart(2, "0")}
                  </p>
                </div>
              ))
            ) : (
              <p>No active rates are available.</p>
            )}
            <p style={{ padding: 20, background: "#ecefe4", marginTop: 30 }}>
              Online booking is not available yet. Please contact the parking
              operator for assistance.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
