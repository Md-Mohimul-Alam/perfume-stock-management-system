const Counter =
  require("../models/Counter");

/* ========================================
   FIND EXISTING MAX NUMBER
======================================== */

const findExistingMax =
  async ({
    Model,
    field,
    prefix,
  }) => {
    const regex =
      new RegExp(
        `^${prefix}-(\\d+)$`
      );

    const records =
      await Model.find(
        {
          [field]: regex,
        },
        {
          [field]: 1,
        }
      ).lean();

    let max = 0;

    for (
      const record of records
    ) {
      const value =
        String(
          record[field] ||
          ""
        );

      const match =
        value.match(regex);

      if (!match) {
        continue;
      }

      const number =
        Number(match[1]);

      if (
        Number.isFinite(number) &&
        number > max
      ) {
        max = number;
      }
    }

    return max;
  };

/* ========================================
   INITIALIZE COUNTER
======================================== */

const initializeCounter =
  async ({
    key,
    Model,
    field,
    prefix,
  }) => {
    const existingMax =
      await findExistingMax({
        Model,
        field,
        prefix,
      });

    /*
      Only inserts when the counter
      does not exist.

      If another request creates it first,
      MongoDB simply uses the existing one.
    */

    await Counter.findOneAndUpdate(
      {
        key,
      },
      {
        $setOnInsert: {
          key,
          sequence:
            existingMax,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );
  };

/* ========================================
   GET NEXT SEQUENCE
======================================== */

exports.getNextSequence =
  async ({
    key,
    Model,
    field,
    prefix,
    padding = 4,
  }) => {
    if (
      !key ||
      !Model ||
      !field ||
      !prefix
    ) {
      throw new Error(
        "Sequence configuration is incomplete"
      );
    }

    /*
      Migration-safe:

      The first time this runs,
      initialize counter from existing
      INV-xxxx / ORD-xxxx records.
    */

    const existingCounter =
      await Counter.findOne({
        key,
      }).lean();

    if (!existingCounter) {
      await initializeCounter({
        key,
        Model,
        field,
        prefix,
      });
    }

    /*
      Atomic increment.

      Even if multiple requests arrive
      at exactly the same time, MongoDB
      increments this one document safely.
    */

    const counter =
      await Counter.findOneAndUpdate(
        {
          key,
        },
        {
          $inc: {
            sequence: 1,
          },
        },
        {
          new: true,
        }
      );

    if (!counter) {
      throw new Error(
        `Unable to generate ${prefix} sequence`
      );
    }

    return `${prefix}-${String(
      counter.sequence
    ).padStart(
      padding,
      "0"
    )}`;
  };