import { FirmApp } from "@/components/firm/FirmApp";

// /f/<name><region><number>: the link the enumerator gave the firm. The
// server resolves it by region and number; the name part is decorative.
export const dynamic = "force-dynamic";

export default async function FirmFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FirmApp slug={slug} />;
}
