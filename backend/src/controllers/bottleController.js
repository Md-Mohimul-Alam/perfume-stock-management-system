const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

exports.getBottlesWithSales = async (req, res) => {
  try {
    // Fetch all bottles
    const bottles = await Bottle.find();

    // Aggregate sold quantities per bottle from sales
    const soldAgg = await Sale.aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      { $unwind: "$product.sizes" },
      {
        $match: {
          $expr: { $eq: ["$product.sizes.sizeMl", "$items.sizeMl"] }
        }
      },
      {
        $lookup: {
          from: "bottles",
          localField: "product.sizes.bottle",
          foreignField: "_id",
          as: "bottle"
        }
      },
      { $unwind: "$bottle" },
      {
        $group: {
          _id: "$bottle._id",
          sold: { $sum: "$items.quantity" }
        }
      }
    ]);

    // Build a map: bottleId -> sold
    const soldMap = {};
    soldAgg.forEach(item => { soldMap[item._id.toString()] = item.sold; });

    // Combine
    const result = bottles.map(b => ({
      ...b.toObject(),
      sold: soldMap[b._id.toString()] || 0,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};