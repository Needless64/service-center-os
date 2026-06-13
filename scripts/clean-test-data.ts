require("dotenv").config({ path: ".env.local" });

const { sanityClient } = require("../src/lib/sanity/client");

async function cleanTestData() {
  try {
    console.log("Cleaning up test data...");

    // Delete test bookings
    const bookings: any[] = await sanityClient.fetch(
      `*[_type == 'booking' && bookingId match 'test-*']`,
    );
    if (bookings.length > 0) {
      console.log(`Deleting ${bookings.length} test bookings...`);
      const mutations = bookings.map((b: any) => ({
        delete: { id: b._id },
      }));
      await sanityClient.mutate(mutations);
    }

    // Delete test customers
    const customers: any[] = await sanityClient.fetch(
      `*[_type == 'customer' && customerId match 'test-*']`,
    );
    if (customers.length > 0) {
      console.log(`Deleting ${customers.length} test customers...`);
      const mutations = customers.map((c: any) => ({
        delete: { id: c._id },
      }));
      await sanityClient.mutate(mutations);
    }

    console.log("Test data cleanup complete!");
  } catch (error) {
    console.error("Error cleaning test data:", error);
    process.exit(1);
  }
}

cleanTestData();
