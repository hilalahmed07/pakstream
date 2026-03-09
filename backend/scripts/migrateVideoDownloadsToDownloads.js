/* eslint-disable no-console */
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables and models by bootstrapping the server config
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const VideoDownload = require('../src/models/VideoDownload');
const Download = require('../src/models/Download');

async function migrate() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/pakstream';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const existing = await VideoDownload.find().lean();
    console.log(`Found ${existing.length} legacy VideoDownload documents`);

    if (!existing.length) {
      console.log('Nothing to migrate. Exiting.');
      await mongoose.disconnect();
      return;
    }

    const bulkOps = existing.map((doc) => ({
      updateOne: {
        filter: {
          user: doc.user,
          assetType: 'video',
          assetId: doc.video,
          downloadedAt: doc.downloadedAt,
        },
        update: {
          $setOnInsert: {
            user: doc.user,
            assetType: 'video',
            assetId: doc.video,
            downloadedAt: doc.downloadedAt,
            ipAddress: doc.ipAddress || null,
            userAgent: doc.userAgent || null,
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length) {
      const result = await Download.bulkWrite(bulkOps, { ordered: false });
      console.log('Migration complete:', {
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
      });
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  migrate();
}

