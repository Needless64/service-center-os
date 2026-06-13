import { getAvailableDays } from "@/lib/whatsapp/slotHelper";

async function verifySlots() {
  const days = await getAvailableDays(7);
  console.log("=== Available Days from Slot Helper ===");
  if (days.length === 0) {
    console.log("No available days found.");
    return;
  }
  for (const day of days) {
    console.log(`\n${day.dayLabel} (${day.date}):`);
    if (day.slots.length === 0) {
      console.log("  No slots available for this day.");
    } else {
      for (const slot of day.slots) {
        console.log(`  ${slot.display} - ${slot.spotsLeft} spots left`);
      }
    }
  }
}

verifySlots().catch(console.error);
