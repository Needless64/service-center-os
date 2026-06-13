"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../../../sanity.config";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
const bookings: any[] = await sanityClient.fetch(
  `*[_type == 'booking' && bookingId.startsWith('test-')]`,
);
