"import { sanityClient } from '../src/lib/sanity/client';

async function cleanTestData() {
  try {
    console.log('Cleaning up test data...');
    
    // Delete test bookings
    const bookings: any[] = await sanityClient.fetch(`*[_type == 'booking' && bookingId.startsWith('test-')]`);
    if (bookings.length > 0) {
      console.log(`Deleting ${bookings.length} test bookings...`);
      await sanityClient.delete(bookings.map((b: any) => b._id));
    }
    
    // Delete test customers
    const customers: any[] = await sanityClient.fetch(`*[_type == 'customer' && customerId.startsWith('test-')]`);
    if (customers.length > 0) {
      console.log(`Deleting ${customers.length} test customers...`);
      await sanityClient.delete(customers.map((c: any) => c._id));
    }
    
    console.log('Test data cleanup complete!');
  } catch (error) {
    console.error('Error cleaning test data:', error);
    process.exit(1);
  }
}

cleanTestData();"
