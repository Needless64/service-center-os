import { sanityClient } from '../src/lib/sanity/client';

async function cleanTestData() {
  try {
    console.log('Cleaning up test data...');
    
    // Delete test bookings
    const bookings = await sanityClient.fetch(`*[_type == 'booking' && bookingId.startsWith('test-')]`);
    if (bookings.length > 0) {
      console.log(`Deleting ${bookings.length} test bookings...`);
      await sanityClient.delete(bookings.map(b => b._id));
    }
    
    // Delete test customers
    const customers = await sanityClient.fetch(`*[_type == 'customer' && customerId.startsWith('test-')]`);
    if (customers.length > 0) {
      console.log(`Deleting ${customers.length} test customers...`);
      await sanityClient.delete(customers.map(c => c._id));
    }
    
    console.log('Test data cleanup complete!');
  } catch (error) {
    console.error('Error cleaning test data:', error);
    process.exit(1);
  }
}

cleanTestData();