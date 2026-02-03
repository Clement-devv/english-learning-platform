// server/migrations/001-add-recurring-fields.js
import mongoose from 'mongoose';
import { config } from '../config/config.js';

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Add new fields to existing bookings
    console.log('📝 Updating bookings collection...');
    const bookingResult = await db.collection('bookings').updateMany(
      { recurringPatternId: { $exists: false } },
      { 
        $set: { 
          isRecurring: false,
          recurringPatternId: null
        } 
      }
    );
    console.log(`✅ Updated ${bookingResult.modifiedCount} bookings`);

    // Create indexes for bookings
    console.log('📝 Creating indexes for bookings...');
    await db.collection('bookings').createIndex({ recurringPatternId: 1 });
    await db.collection('bookings').createIndex({ scheduledTime: 1, status: 1 });
    await db.collection('bookings').createIndex({ teacherId: 1, status: 1 });
    await db.collection('bookings').createIndex({ studentId: 1, status: 1 });
    console.log('✅ Booking indexes created');

    // Create indexes for recurring patterns
    console.log('📝 Creating indexes for recurring patterns...');
    await db.collection('recurringpatterns').createIndex({ teacherId: 1, status: 1 });
    await db.collection('recurringpatterns').createIndex({ studentId: 1, status: 1 });
    await db.collection('recurringpatterns').createIndex({ startTime: 1 });
    console.log('✅ Recurring pattern indexes created');

    console.log('🎉 Database migrations completed successfully!');

    // Verify
    const indexes = await db.collection('bookings').indexes();
    console.log('📋 Current indexes:', indexes.length);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  }
}

runMigration();