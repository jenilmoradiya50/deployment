const mongoose = require('mongoose');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log('✅ [MongoDB] Connected successfully to MongoDB Atlas database');
      return m;
    }).catch((err) => {
      console.warn('⚠️ [MongoDB] Connection error, using local fallback:', err.message);
      cached.promise = null;
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    return null;
  }

  return cached.conn;
}

function isMongoConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

module.exports = {
  connectToDatabase,
  isMongoConnected
};
