import Link from "next/link";
export const metadata = { title: "About · GMC Smart Parking" };
export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-20">
      <p className="text-sm uppercase tracking-widest text-emerald-300">
        Guwahati Municipal Corporation
      </p>
      <h1 className="mt-5 text-4xl font-semibold">About Smart Parking</h1>
      <p className="mt-7 max-w-2xl leading-8 text-slate-300">
        Smart Parking brings parking areas, their leaseholding organizations and
        on-site operators into one managed network. Site QR codes help visitors
        find information about a parking area and its published rates.
      </p>
      <p className="mt-5 max-w-2xl leading-8 text-slate-300">
        Online booking and payment processing are not available yet. Please
        contact the on-site operator for parking assistance.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-emerald-300 underline underline-offset-4"
      >
        Return to parking locations
      </Link>
    </section>
  );
}
