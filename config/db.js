import mongoose from 'mongoose';
import { env } from './env.js';

// Serverless mein har request par naya connection nahi banna chahiye,
// is liye connection ko global cache mein rakhte hain.
let cached = global._hcmMongoose;
if (!cached) {
  cached = global._hcmMongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      })
      .catch((err) => {
        cached.promise = null; // agle request par dobara try ho
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
