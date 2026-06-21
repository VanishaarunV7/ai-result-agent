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

app.use('/api/result-agent', resultRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/report', reportRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});