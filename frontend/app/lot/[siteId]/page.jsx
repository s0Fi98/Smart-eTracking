// app/lot/[siteId]/page.jsx
import { SITES_REGISTRY } from "../../../lib/mock-data";
import { notFound } from "next/navigation";
import LotClient from "../../../components/LotClient";

export async function generateStaticParams() {
  return Object.keys(SITES_REGISTRY).map((id) => ({
    siteId: id,
  }));
}

export default async function LotPage({ params }) {
  const resolvedParams = await params;
  const rawId = resolvedParams.siteId;

  // Handle both decoded and URL-encoded forms
  const siteId = decodeURIComponent(rawId);
  const site = SITES_REGISTRY[siteId] || SITES_REGISTRY[rawId];

  if (!site) {
    return notFound();
  }

  return <LotClient site={site} />;
}