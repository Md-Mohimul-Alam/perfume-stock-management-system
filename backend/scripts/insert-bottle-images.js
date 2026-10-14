const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Bottle = require('../src/models/Bottle');

/* ========================================
   ENV
======================================== */

dotenv.config();

/* ========================================
   IMAGE DATA
======================================== */

const imageData = [
  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/6051fFT1/Chat-GPT-Image-Oct-15-2026-12-03-03-AM-6.png',
  },

  {
    sizes: [30],
    url: 'https://i.ibb.co.com/zWTmSbRq/Chat-GPT-Image-Oct-15-2026-12-03-00-AM-5.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/TDNDZS62/Chat-GPT-Image-Oct-15-2026-12-02-56-AM-4.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/KpYkWcYY/Chat-GPT-Image-Oct-15-2026-12-02-54-AM-3.png',
  },

  {
    sizes: [30],
    url: 'https://i.ibb.co.com/cKSrBWhw/Chat-GPT-Image-Oct-15-2026-12-02-50-AM-2.png',
  },

  {
    sizes: [15],
    url: 'https://i.ibb.co.com/3wQjRJr/Chat-GPT-Image-Oct-15-2026-12-02-44-AM-1.png',
  },

  {
    sizes: [3.5],
    url: 'https://i.ibb.co.com/fYWtp72n/Chat-GPT-Image-Oct-14-2026-11-56-11-PM-10.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/MD2DVK5k/Chat-GPT-Image-Oct-14-2026-11-56-08-PM-9.png',
  },

  {
    sizes: [30, 50, 100],
    url: 'https://i.ibb.co.com/Y4y78YvF/Chat-GPT-Image-Oct-14-2026-11-56-06-PM-8.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/8L2m2M5T/Chat-GPT-Image-Oct-14-2026-11-56-04-PM-7.png',
  },

  {
    sizes: [30, 50, 100],
    url: 'https://i.ibb.co.com/8DD4TjPH/Chat-GPT-Image-Oct-14-2026-11-56-03-PM-6.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/5xGV6TtK/Chat-GPT-Image-Oct-14-2026-11-56-01-PM-5.png',
  },

  {
    sizes: [6],
    url: 'https://i.ibb.co.com/wZBsNz00/Chat-GPT-Image-Oct-14-2026-11-55-57-PM-4.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/RGxK65TZ/Chat-GPT-Image-Oct-14-2026-11-55-53-PM-3.png',
  },

  {
    sizes: [30, 50],
    url: 'https://i.ibb.co.com/BHrKHH3g/Chat-GPT-Image-Oct-14-2026-11-55-51-PM-2.png',
  },

  {
    sizes: [6],
    url: 'https://i.ibb.co.com/gG85k8P/Chat-GPT-Image-Oct-14-2026-11-55-50-PM-1.png',
  },
];

/* ========================================
   BUILD SIZE -> IMAGES MAP
======================================== */

const buildSizeImageMap = () => {
  const map = new Map();

  for (const item of imageData) {
    for (const size of item.sizes) {
      if (!map.has(size)) {
        map.set(size, []);
      }

      const currentImages =
        map.get(size);

      if (
        !currentImages.includes(
          item.url
        )
      ) {
        currentImages.push(
          item.url
        );
      }
    }
  }

  return map;
};

/* ========================================
   MAIN
======================================== */

const run = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        'MONGO_URI or MONGODB_URI is missing from backend/.env'
      );
    }

    console.log('');
    console.log(
      'Connecting to MongoDB...'
    );

    await mongoose.connect(
      mongoUri
    );

    console.log(
      '✅ MongoDB connected'
    );

    const sizeImageMap =
      buildSizeImageMap();

    console.log('');
    console.log(
      'Image mapping:'
    );
    console.log(
      '-----------------------------'
    );

    for (
      const [
        size,
        images,
      ] of sizeImageMap
    ) {
      console.log(
        `${size}ml -> ${images.length} image(s)`
      );
    }

    console.log('');
    console.log(
      'Updating bottle documents...'
    );
    console.log(
      '-----------------------------'
    );

    let updatedDocuments =
      0;

    let missingSizes =
      0;

    for (
      const [
        sizeMl,
        newImages,
      ] of sizeImageMap
    ) {
      /*
        This finds ALL bottle records
        having the same size.

        Example:
        6ml roll-on
        6ml spray

        Both receive the 6ml images.
      */

      const bottles =
        await Bottle.find({
          sizeMl,
        });

      if (
        bottles.length ===
        0
      ) {
        console.log(
          `⚠️ No ${sizeMl}ml bottle document found`
        );

        missingSizes +=
          1;

        continue;
      }

      for (
        const bottle of bottles
      ) {
        const oldImages =
          Array.isArray(
            bottle.images
          )
            ? bottle.images
            : [];

        /*
          Merge existing images with
          imported images.

          Set removes duplicates.
        */

        const mergedImages =
          [
            ...new Set([
              ...oldImages,
              ...newImages,
            ]),
          ];

        bottle.images =
          mergedImages;

        await bottle.save();

        updatedDocuments +=
          1;

        console.log(
          `✅ ${bottle.sizeMl}ml ${bottle.type}`
        );

        console.log(
          `   Images: ${bottle.images.length}`
        );
      }
    }

    /* ======================================
       VERIFY
    ====================================== */

    console.log('');
    console.log(
      'Current bottle image data:'
    );
    console.log(
      '-----------------------------'
    );

    const bottles =
      await Bottle.find()
        .select(
          'sizeMl type images sellingPrice currentStock'
        )
        .sort({
          sizeMl: 1,
          type: 1,
        })
        .lean();

    for (
      const bottle of bottles
    ) {
      console.log(
        `${bottle.sizeMl}ml ${bottle.type}`
      );

      console.log(
        `   Stock: ${bottle.currentStock || 0}`
      );

      console.log(
        `   Selling Price: ${bottle.sellingPrice || 0}`
      );

      console.log(
        `   Images: ${bottle.images?.length || 0}`
      );
    }

    console.log('');
    console.log(
      '==============================='
    );

    console.log(
      '✅ Bottle image import complete'
    );

    console.log(
      `Updated documents: ${updatedDocuments}`
    );

    console.log(
      `Missing sizes: ${missingSizes}`
    );

    console.log(
      '==============================='
    );
    console.log('');
  } catch (error) {
    console.error('');
    console.error(
      '❌ Bottle image import failed'
    );

    console.error(
      error
    );

    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();

      console.log(
        'MongoDB disconnected.'
      );
    } catch (error) {
      console.error(
        'MongoDB disconnect error:',
        error.message
      );
    }
  }
};

/* ========================================
   RUN
======================================== */

run();