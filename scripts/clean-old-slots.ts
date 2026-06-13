import "dotenv/config";
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN!,
});

async function cleanOldSlots() {
  // Get all slots
  const allSlots = await client.fetch(`
    *[_type == "slot"]{ _id, date, time }
  `);

  console.log(`Found ${allSlots.length} total slots`);

  // Filter for old 6-minute interval slots (not on the hour or half-hour)
  const sixMinuteSlots = allSlots.filter((slot: any) => {
    if (!slot.time) return false;
    // Keep slots at :00 and :30, delete others
    return !slot.time.endsWith(":00") && !slot.time.endsWith(":30");
  });

  console.log(
    `Found ${sixMinuteSlots.length} old 6-minute interval slots to delete`,
  );

  if (sixMinuteSlots.length > 0) {
    // Delete them in batches
    for (const slot of sixMinuteSlots) {
      await client.delete(slot._id);
      console.log(`Deleted slot: ${slot._id} (${slot.date} ${slot.time})`);
    }
    console.log("All old slots deleted!");
  } else {
    console.log("No old slots to clean up");
  }
}

cleanOldSlots().catch(console.error);
