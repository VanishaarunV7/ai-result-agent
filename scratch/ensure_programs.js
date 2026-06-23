const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const STUDENT_PROGRAMS = {
  stu_001: 'P_CS',
  stu_002: 'P_CS',
  stu_003: 'P_CS',
  stu_004: 'P_CS',
  stu_005: 'P_CA',
  stu_006: 'P_CA',
  stu_007: 'P_CA',
  stu_008: 'P_BIO',
  stu_009: 'P_BIO',
  stu_010: 'P_BIO'
};

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const col = mongoose.connection.db.collection('students');
    for (const [studentId, programId] of Object.entries(STUDENT_PROGRAMS)) {
      const res = await col.updateOne(
        { _id: studentId },
        { $set: { program_id: programId } },
        { upsert: true }
      );
      console.log(`Student ${studentId}: program_id updated to ${programId} (Matched: ${res.matchedCount}, Modified: ${res.modifiedCount})`);
    }
    console.log('Program IDs checked and updated successfully.');
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
