import cron from 'node-cron';
import axios from 'axios';

// Run every 15 minutes
export const startAutoConfirmJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('🤖 Running auto-confirmation job...');
      
      const response = await axios.post(
        'http://localhost:5000/api/bookings/auto-confirm',
        {},
        {
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Auto-confirmed ${response.data.confirmedBookings?.length || 0} classes`);
    } catch (error) {
      console.error('❌ Auto-confirm job failed:', error.message);
    }
  });
  
  console.log('✅ Auto-confirmation cron job started (runs every 15 minutes)');
};