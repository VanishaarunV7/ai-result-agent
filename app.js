const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, tls: true, maxPoolSize: 2 })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const resultRoutes = require('./routes/resultAgent');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/report');
const studentRoutes = require('./routes/student');
const ragRoutes = require('./routes/rag');
const studyPlanRoutes = require('./routes/studyPlan');

const feature1Routes = require('./routes/feature1');
const feature2Routes = require('./routes/feature2');
const feature3Routes = require('./routes/feature3');



app.use('/api/result-agent', feature1Routes);
app.use('/api/result-agent', feature2Routes);
app.use('/api/report', feature3Routes);



app.use('/api/result-agent', resultRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/report', reportRoutes);
app.use('/students', studentRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/study-plan', studyPlanRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});