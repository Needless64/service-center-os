/**
 * One-off script to seed/update the default branch with correct configuration.
 *
 * Run locally with:
 *   npx tsx --env-file=.env.local scripts/seed-branch.ts
 */
import "dotenv/config";
import { createClient } from "@sanity/client";

async function main() {
  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: "2024-01-01",
    useCdn: false,
    token: process.env.SANITY_API_TOKEN!,
  });

  const branchConfig = {
    _type: "branch",
    name: "Main Workshop",
    location: "Sharma Auto, Baroda",
    workingDays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    workingHours: {
      start: "09:00",
      end: "18:00",
    },
    slotDurationMinutes: 60, // 1-hour slots (not 6 minutes!)
    capacityPerSlot: 5,
    holidays: [],
    whatsappGreeting:
      "Welcome to Sharma Auto Service Center! How can we help you today?",
    isActive: true,
  };

  // Find existing active branch
  const existing = await sanity.fetch<{ _id: string } | null>(
    '*[_type == "branch" && isActive == true][0]{ _id }',
  );

  if (existing) {
    await sanity.patch(existing._id).set(branchConfig).commit();
    console.log(`Updated branch: ${existing._id}`);
  } else {
    const created = await sanity.create(branchConfig);
    console.log(`Created branch: ${created._id}`);
  }

  console.log("Branch configuration seeded successfully!");
  console.log("- Slot duration: 60 minutes");
  console.log("- Working hours: 09:00 - 18:00");
  console.log("- Capacity per slot: 5");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
