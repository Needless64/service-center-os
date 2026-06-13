import { getAvailableDays } from "../src/lib/whatsapp/slotHelper.js";

async function main() {
  const days = await getAvailableDays(7);
  console.log("=== Available Days ===");
  for (const day of days) {
    console.log(`\n${day.dayLabel} (${day.date}):`);
    for (const slot of day.slots) {
      console.log(`  ${slot.display} - ${slot.spotsLeft} spots left`);
    }
  }
}

main().catch(console.error);
