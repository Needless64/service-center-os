import { sanityClient } from "../src/lib/sanity/client";

async function clearAllSlots() {
  console.log("Fetching all slot documents...");
  const slots = await sanityClient.fetch(`*[_type == "slot"]{_id}`);

  if (slots.length === 0) {
    console.log("No slots found to delete.");
    return;
  }

  console.log(`Found ${slots.length} slots. Deleting in batches...`);

  const transaction = sanityClient.transaction();
  slots.forEach((slot: any) => {
    transaction.delete(slot._id);
  });

  await transaction.commit();
  console.log("Successfully deleted all slot documents.");
}

clearAllSlots().catch(console.error);
