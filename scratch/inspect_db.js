const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const col = mongoose.connection.db.collection('programs');
    const programs = await col.find({}).toArray();
    console.log('--- Programs in DB ---');
    programs.forEach(p => {
      console.log(JSON.stringify(p));
    });
    console.log('----------------------');
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
