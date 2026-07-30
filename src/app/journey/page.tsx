import type { Metadata } from "next";
import { JourneyPlayer } from "@/components/journey/journey-player";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Cinematic Journey · ${BRAND_NAME}`,
  description:
    "Tap through an interactive cinematic journey — beach morning, alpine sunset, desert brotherhood, arctic neon gala.",
};

export default function JourneyPage() {
  return <JourneyPlayer continueHref="/upload" brandName={BRAND_NAME} />;
}
