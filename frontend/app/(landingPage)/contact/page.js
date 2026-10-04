import Link from "next/link";
export const metadata = { title: "Contact · GMC Smart Parking" };
export default function ContactPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-20">
      <p className="text-sm uppercase tracking-widest text-emerald-300">
        Parking assistance
      </p>
      <h1 className="mt-5 text-4xl font-semibold">
        Contact your parking operator
      </h1>
      <p className="mt-7 max-w-2xl leading-8 text-slate-300">
        For help with a parking space, operating hours or local rates, speak to
        the operator at the parking area. Keep your parking location and any
        booking or payment reference ready when requesting assistance.
      </p>
      <p className="mt-5 max-w-2xl leading-8 text-slate-300">
        Organization staff should contact their administrator for account access
        or changes to site details.
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
