import type { Metadata } from "next";
import { TvTokenDisplay } from "@/components/display/TvTokenDisplay";

export const metadata: Metadata = {
  title: "Token display · Campus Eats",
  robots: { index: false, follow: false },
};

export default async function PublicDisplayPage({
  params,
}: {
  params: Promise<{ canteenId: string }>;
}) {
  const { canteenId } = await params;
  return <TvTokenDisplay canteenId={canteenId} />;
}
