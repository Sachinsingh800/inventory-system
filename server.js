const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');

(async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
})();