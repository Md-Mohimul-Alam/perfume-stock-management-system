const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');

/* ========================================
   HELPERS
======================================== */

const getId = (value) => {
  return (
    value?._id?.toString() ||
    value?.toString() ||
    null
  );
};

const getItemType = (item) => {
  /*
    Old existing sales have no itemType.
    They are normal product/perfume sales.
  */

  return (
    item?.itemType ||
    'product'
  );
};

/* ========================================
   GET EFFECTIVE PRODUCT BLEND
======================================== */

function getSizeBlend(
  product,
  sizeMl
) {
  const sizeVariant =
    product.sizes?.find(
      (size) =>
        Number(
          size.sizeMl
        ) ===
        Number(
          sizeMl
        )
    );

  if (
    sizeVariant &&
    sizeVariant
      .blendComponents &&
    sizeVariant
      .blendComponents
      .length > 0
  ) {
    return sizeVariant
      .blendComponents;
  }

  return (
    product
      .blendComponents ||
    []
  );
}

/* ========================================
   APPLY EXACT BLENDS
======================================== */

/*
  Existing behavior preserved.

  Important:
  This still modifies Product blend
  configuration.

  Long-term I recommend separating this
  from Rebuild Stock, but I am preserving
  your current behavior here.
*/

async function applyExactBlends() {
  console.log(
    'Applying exact product blends...'
  );

  const fixatives = [
    {
      name: 'Ethanol',
      sku: 'ETH',
      type: 'ethanol',
    },

    {
      name:
        'Iso E Super',
      sku: 'Iso',
      type: 'fixative',
    },

    {
      name:
        'Galaxolide',
      sku: 'Glx',
      type: 'fixative',
    },

    {
      name:
        'Ambroxan',
      sku: 'Ambx',
      type: 'fixative',
    },
  ];

  for (
    const item of
    fixatives
  ) {
    let material =
      await RawMaterial.findOne(
        {
          sku:
            item.sku,
        }
      );

    if (!material) {
      material =
        await RawMaterial.findOne(
          {
            name:
              item.name,
          }
        );
    }

    if (!material) {
      console.log(
        `Creating material: ${item.name} (${item.sku})`
      );

      material =
        new RawMaterial({
          name:
            item.name,

          sku:
            item.sku,

          type:
            item.type,

          currentStockMl:
            0,

          avgCostPerMl:
            0,
        });

      await material.save();
    } else if (
      material.type !==
      item.type
    ) {
      material.type =
        item.type;

      await material.save();
    }
  }

  const specialOils = [
    {
      name:
        'Dunhill Icon',

      sku:
        'DunIco',

      type:
        'oil',
    },

    {
      name:
        'Diptyque tam dao',

      sku:
        'DipTam',

      type:
        'oil',
    },

    {
      name:
        'Gucci Flora',

      sku:
        'GucFla',

      type:
        'oil',
    },

    {
      name:
        'Creed Aventus',

      sku:
        'CreAve',

      type:
        'oil',
    },
  ];

  for (
    const item of
    specialOils
  ) {
    let material =
      await RawMaterial.findOne(
        {
          sku:
            item.sku,
        }
      );

    if (!material) {
      material =
        await RawMaterial.findOne(
          {
            name:
              item.name,
          }
        );
    }

    if (!material) {
      console.log(
        `Creating material: ${item.name} (${item.sku})`
      );

      material =
        new RawMaterial({
          name:
            item.name,

          sku:
            item.sku,

          type:
            item.type,

          currentStockMl:
            0,

          avgCostPerMl:
            0,
        });

      await material.save();
    }
  }

  const materials =
    await RawMaterial.find();

  const matMap = {};

  materials.forEach(
    (material) => {
      matMap[
        material.sku
      ] =
        material;
    }
  );

  const products =
    await Product.find({
      isActive:
        true,
    });

  console.log(
    `Applying blends to ${products.length} active products.`
  );

  const sprayRules = {
    6: {
      oil: 58,
      ethanol: 39,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    15: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    30: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    50: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    100: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },
  };

  const specialSprayRules = {
    6: {
      oil: 55,
      ethanol: 45,
      iso: 0,
      glx: 0,
      ambx: 0,
    },

    15: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    30: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    50: {
      oil: 55,
      ethanol: 42,
      iso: 1,
      glx: 1,
      ambx: 1,
    },

    100: {
      oil: 60,
      ethanol: 37,
      iso: 1,
      glx: 1,
      ambx: 1,
    },
  };

  const specialSprays = {
    SR_SP: {
      oilComponents: [
        {
          sku:
            'DunIco',

          percentage:
            52,
        },

        {
          sku:
            'DipTam',

          percentage:
            48,
        },
      ],
    },

    LUXE1_SP: {
      oilComponents: [
        {
          sku:
            'GucFla',

          percentage:
            28,
        },

        {
          sku:
            'CreAve',

          percentage:
            72,
        },
      ],
    },
  };

  let updated =
    0;

  let skipped =
    0;

  for (
    const product of
    products
  ) {
    try {
      /* ==================================
         ROLL-ON
      ================================== */

      if (
        product.type ===
        'roll-on'
      ) {
        const oilSku =
          product.sku;

        const oilMaterial =
          matMap[
            oilSku
          ];

        if (!oilMaterial) {
          console.warn(
            `No oil material for roll-on ${product.name} (${product.sku})`
          );

          skipped += 1;

          continue;
        }

        if (
          !product.baseOil ||
          product.baseOil.toString() !==
            oilMaterial._id.toString()
        ) {
          product.baseOil =
            oilMaterial._id;

          for (
            const size of
            product.sizes
          ) {
            size.oilMlUsed =
              size.sizeMl;

            size.ethanolMlUsed =
              0;

            size.fixativeMlUsed =
              0;
          }

          await product.save();

          updated += 1;
        }

        continue;
      }

      /* ==================================
         SPRAY
      ================================== */

      if (
        product.type ===
        'spray'
      ) {
        const isSpecialSpray =
          Boolean(
            specialSprays[
              product.sku
            ]
          );

        const activeRules =
          isSpecialSpray
            ? specialSprayRules
            : sprayRules;

        const blendConfig =
          specialSprays[
            product.sku
          ];

        const ethanolMaterial =
          matMap.ETH;

        const isoMaterial =
          matMap.Iso;

        const glxMaterial =
          matMap.Glx;

        const ambxMaterial =
          matMap.Ambx;

        let productChanged =
          false;

        for (
          const size of
          product.sizes
        ) {
          const sizeMl =
            Number(
              size.sizeMl
            );

          let sizeRule =
            null;

          const ruleSizes =
            Object.keys(
              activeRules
            )
              .map(Number)
              .sort(
                (
                  a,
                  b
                ) =>
                  a - b
              );

          for (
            const ruleSize of
            ruleSizes
          ) {
            if (
              sizeMl <=
              ruleSize
            ) {
              sizeRule =
                activeRules[
                  String(
                    ruleSize
                  )
                ];

              break;
            }
          }

          if (!sizeRule) {
            const finalRuleSize =
              ruleSizes[
                ruleSizes.length -
                  1
              ];

            sizeRule =
              activeRules[
                String(
                  finalRuleSize
                )
              ];
          }

          if (!sizeRule) {
            continue;
          }

          let components =
            [];

          if (
            blendConfig
          ) {
            const oilTotalPercentage =
              sizeRule.oil;

            for (
              const oilComponent of
              blendConfig
                .oilComponents
            ) {
              const material =
                matMap[
                  oilComponent.sku
                ];

              if (!material) {
                continue;
              }

              const percentage =
                (
                  oilComponent.percentage /
                  100
                ) *
                oilTotalPercentage;

              if (
                percentage >
                0
              ) {
                components.push(
                  {
                    material:
                      material._id,

                    percentage:
                      Number(
                        percentage.toFixed(
                          2
                        )
                      ),
                  }
                );
              }
            }
          } else {
            const oilSku =
              product.sku.replace(
                '_SP',
                ''
              );

            let oilMaterial =
              matMap[
                oilSku
              ];

            if (!oilMaterial) {
              const baseName =
                product.name.replace(
                  ' Spray',
                  ''
                );

              oilMaterial =
                await RawMaterial.findOne(
                  {
                    name: {
                      $regex:
                        new RegExp(
                          `^${baseName}$`,
                          'i'
                        ),
                    },
                  }
                );
            }

            if (!oilMaterial) {
              console.warn(
                `No oil material for spray ${product.name} (${product.sku})`
              );

              break;
            }

            if (
              sizeRule.oil >
              0
            ) {
              components.push(
                {
                  material:
                    oilMaterial._id,

                  percentage:
                    sizeRule.oil,
                }
              );
            }
          }

          if (
            ethanolMaterial &&
            sizeRule.ethanol >
              0
          ) {
            components.push(
              {
                material:
                  ethanolMaterial._id,

                percentage:
                  sizeRule.ethanol,
              }
            );
          }

          if (
            isoMaterial &&
            sizeRule.iso >
              0
          ) {
            components.push(
              {
                material:
                  isoMaterial._id,

                percentage:
                  sizeRule.iso,
              }
            );
          }

          if (
            glxMaterial &&
            sizeRule.glx >
              0
          ) {
            components.push(
              {
                material:
                  glxMaterial._id,

                percentage:
                  sizeRule.glx,
              }
            );
          }

          if (
            ambxMaterial &&
            sizeRule.ambx >
              0
          ) {
            components.push(
              {
                material:
                  ambxMaterial._id,

                percentage:
                  sizeRule.ambx,
              }
            );
          }

          const total =
            components.reduce(
              (
                sum,
                component
              ) =>
                sum +
                Number(
                  component.percentage ||
                    0
                ),
              0
            );

          if (
            Math.abs(
              total -
                100
            ) >
              0.01 &&
            components.length >
              0
          ) {
            const difference =
              100 -
              total;

            components[0]
              .percentage =
              Number(
                (
                  components[0]
                    .percentage +
                  difference
                ).toFixed(
                  2
                )
              );
          }

          const current =
            size
              .blendComponents ||
            [];

          const correct =
            current.length ===
              components.length &&
            current.every(
              (
                component,
                index
              ) => {
                const currentMaterialId =
                  getId(
                    component.material
                  );

                const newMaterialId =
                  getId(
                    components[
                      index
                    ].material
                  );

                return (
                  currentMaterialId ===
                    newMaterialId &&
                  Math.abs(
                    Number(
                      component.percentage
                    ) -
                      Number(
                        components[
                          index
                        ]
                          .percentage
                      )
                  ) <
                    0.01
                );
              }
            );

          if (!correct) {
            size.blendComponents =
              components.map(
                (
                  component
                ) => ({
                  material:
                    component.material,

                  percentage:
                    component.percentage,
                })
              );

            productChanged =
              true;
          }
        }

        if (
          product
            .blendComponents &&
          product
            .blendComponents
            .length >
            0
        ) {
          product.blendComponents =
            [];

          productChanged =
            true;
        }

        product.baseOil =
          null;

        if (
          productChanged
        ) {
          product.markModified(
            'sizes'
          );

          product.markModified(
            'blendComponents'
          );

          await product.save();

          updated += 1;
        }

        continue;
      }

      skipped += 1;
    } catch (error) {
      console.error(
        `Error processing ${product.name}:`,
        error.message
      );
    }
  }

  console.log(
    `Blends applied: ${updated} updated, ${skipped} skipped.`
  );
}

/* ========================================
   REBUILD STOCK
======================================== */

exports.rebuildStock =
  async (
    req,
    res
  ) => {
    try {
      console.log(
        'Rebuilding inventory...'
      );

      /* ==================================
         PURCHASES
      ================================== */

      const purchases =
        await Purchase.find()
          .lean();

      const purchaseQty =
        {};

      const purchaseCost =
        {};

      for (
        const purchase of
        purchases
      ) {
        for (
          const item of
          purchase.items ||
          []
        ) {
          const entityId =
            getId(
              item.item
            );

          if (!entityId) {
            continue;
          }

          purchaseQty[
            entityId
          ] =
            (
              purchaseQty[
                entityId
              ] ||
              0
            ) +
            Number(
              item.quantity ||
                0
            );

          if (
            !purchaseCost[
              entityId
            ]
          ) {
            purchaseCost[
              entityId
            ] = {
              totalCost:
                0,

              totalQty:
                0,
            };
          }

          purchaseCost[
            entityId
          ].totalCost +=
            Number(
              item.totalCost ||
                0
            );

          purchaseCost[
            entityId
          ].totalQty +=
            Number(
              item.quantity ||
                0
            );
        }
      }

      /* ==================================
         SALES
      ================================== */

      const sales =
        await Sale.find()
          .lean();

      const products =
        await Product.find()
          .lean();

      const productMap =
        {};

      products.forEach(
        (product) => {
          productMap[
            product._id.toString()
          ] =
            product;
        }
      );

      const materials =
        await RawMaterial.find();

      const materialNameMap =
        {};

      materials.forEach(
        (material) => {
          materialNameMap[
            material.name.toLowerCase()
          ] =
            material._id.toString();
        }
      );

      const rawConsumption =
        {};

      /*
        Bottles included free with perfume.
      */
      const perfumeBottleUsage =
        {};

      /*
        Bottles sold directly without perfume.
      */
      const directBottleSales =
        {};

      const brokenProducts =
        new Set();

      for (
        const sale of
        sales
      ) {
        for (
          const item of
          sale.items ||
          []
        ) {
          const itemType =
            getItemType(
              item
            );

          const quantity =
            Number(
              item.quantity ||
                0
            );

          if (
            quantity <= 0
          ) {
            continue;
          }

          /* ==============================
             DIRECT BOTTLE SALE
          ============================== */

          if (
            itemType ===
            'bottle'
          ) {
            const bottleId =
              getId(
                item.bottle
              );

            if (!bottleId) {
              console.warn(
                `Bottle sale without bottle reference in ${sale.invoiceNo}`
              );

              continue;
            }

            directBottleSales[
              bottleId
            ] =
              (
                directBottleSales[
                  bottleId
                ] ||
                0
              ) +
              quantity;

            /*
              IMPORTANT:
              Stop here.

              Direct empty bottle sale does
              NOT consume perfume materials.
            */

            continue;
          }

          /* ==============================
             NORMAL PERFUME PRODUCT SALE
          ============================== */

          const productId =
            getId(
              item.product
            );

          if (!productId) {
            console.warn(
              `Product reference missing in ${sale.invoiceNo}`
            );

            continue;
          }

          const product =
            productMap[
              productId
            ];

          if (!product) {
            console.warn(
              `Product ${productId} not found for ${sale.invoiceNo}`
            );

            continue;
          }

          const sizeMl =
            Number(
              item.sizeMl ||
                0
            );

          const sizeVariant =
            product.sizes?.find(
              (size) =>
                Number(
                  size.sizeMl
                ) ===
                sizeMl
            );

          /*
            Free bottle included with perfume.
          */

          if (
            sizeVariant
              ?.bottle
          ) {
            const bottleId =
              getId(
                sizeVariant.bottle
              );

            perfumeBottleUsage[
              bottleId
            ] =
              (
                perfumeBottleUsage[
                  bottleId
                ] ||
                0
              ) +
              quantity;
          }

          /* ==============================
             ROLL-ON RAW MATERIAL
          ============================== */

          if (
            product.type ===
            'roll-on'
          ) {
            if (
              product.baseOil
            ) {
              const oilId =
                getId(
                  product.baseOil
                );

              const oilMlUsed =
                Number(
                  sizeVariant
                    ?.oilMlUsed ||
                    sizeMl
                );

              const totalMl =
                oilMlUsed *
                quantity;

              rawConsumption[
                oilId
              ] =
                (
                  rawConsumption[
                    oilId
                  ] ||
                  0
                ) +
                totalMl;
            } else {
              brokenProducts.add(
                `${product.name} (${product.sku})`
              );
            }

            continue;
          }

          /* ==============================
             SPRAY RAW MATERIAL
          ============================== */

          if (
            product.type ===
            'spray'
          ) {
            const components =
              getSizeBlend(
                product,
                sizeMl
              );

            if (
              components.length ===
              0
            ) {
              brokenProducts.add(
                `${product.name} @ ${sizeMl}ml (${product.sku})`
              );

              continue;
            }

            for (
              const component of
              components
            ) {
              const percentage =
                Number(
                  component.percentage ||
                    0
                );

              if (
                percentage <= 0
              ) {
                continue;
              }

              let materialId =
                getId(
                  component.material
                );

              if (
                !materialId &&
                component.name
              ) {
                materialId =
                  materialNameMap[
                    component.name.toLowerCase()
                  ];
              }

              if (!materialId) {
                continue;
              }

              const mlUsed =
                sizeMl *
                (
                  percentage /
                  100
                ) *
                quantity;

              rawConsumption[
                materialId
              ] =
                (
                  rawConsumption[
                    materialId
                  ] ||
                  0
                ) +
                mlUsed;
            }
          }
        }
      }

      /* ==================================
         WASTAGE
      ================================== */

      const materialWastageLogs =
        await InventoryLog.find(
          {
            reason:
              'wastage',

            material: {
              $ne: null,
            },
          }
        ).lean();

      const materialWastage =
        {};

      for (
        const log of
        materialWastageLogs
      ) {
        const id =
          getId(
            log.material
          );

        if (!id) {
          continue;
        }

        materialWastage[
          id
        ] =
          (
            materialWastage[
              id
            ] ||
            0
          ) +
          Number(
            log.changeQuantity ||
              0
          );
      }

      const bottleWastageLogs =
        await InventoryLog.find(
          {
            reason:
              'wastage',

            bottle: {
              $ne: null,
            },
          }
        ).lean();

      const bottleWastage =
        {};

      for (
        const log of
        bottleWastageLogs
      ) {
        const id =
          getId(
            log.bottle
          );

        if (!id) {
          continue;
        }

        bottleWastage[
          id
        ] =
          (
            bottleWastage[
              id
            ] ||
            0
          ) +
          Number(
            log.changeQuantity ||
              0
          );
      }

      /* ==================================
         PRODUCTION / STOCK ADDITIONS
      ================================== */

      const productionLogs =
        await InventoryLog.find(
          {
            reason:
              'production',

            bottle: {
              $ne: null,
            },

            changeQuantity: {
              $gt: 0,
            },
          }
        ).lean();

      const bottleProduction =
        {};

      for (
        const log of
        productionLogs
      ) {
        const id =
          getId(
            log.bottle
          );

        if (!id) {
          continue;
        }

        bottleProduction[
          id
        ] =
          (
            bottleProduction[
              id
            ] ||
            0
          ) +
          Number(
            log.changeQuantity ||
              0
          );
      }

      /* ==================================
         UPDATE RAW MATERIALS
      ================================== */

      const allMaterials =
        await RawMaterial.find();

      let materialUpdatedCount =
        0;

      for (
        const material of
        allMaterials
      ) {
        const id =
          material._id.toString();

        const purchased =
          purchaseQty[
            id
          ] ||
          0;

        const consumed =
          rawConsumption[
            id
          ] ||
          0;

        /*
          Existing wastage logs are negative.
        */

        const wasted =
          materialWastage[
            id
          ] ||
          0;

        let netStock =
          purchased -
          consumed +
          wasted;

        if (
          netStock <
          0
        ) {
          netStock =
            0;
        }

        const costData =
          purchaseCost[
            id
          ];

        let avgCost =
          0;

        if (
          costData &&
          costData.totalQty >
            0
        ) {
          avgCost =
            costData.totalCost /
            costData.totalQty;
        }

        let changed =
          false;

        if (
          Math.abs(
            Number(
              material.currentStockMl ||
                0
            ) -
              netStock
          ) >
          0.0001
        ) {
          material.currentStockMl =
            netStock;

          changed =
            true;
        }

        if (
          Math.abs(
            Number(
              material.avgCostPerMl ||
                0
            ) -
              avgCost
          ) >
          0.0001
        ) {
          material.avgCostPerMl =
            avgCost;

          changed =
            true;
        }

        const shouldStockOut =
          netStock ===
          0;

        if (
          material.isStockOut !==
          shouldStockOut
        ) {
          material.isStockOut =
            shouldStockOut;

          changed =
            true;
        }

        if (changed) {
          await material.save();

          materialUpdatedCount +=
            1;
        }
      }

      /* ==================================
         UPDATE BOTTLES
      ================================== */

      const allBottles =
        await Bottle.find();

      let bottleUpdatedCount =
        0;

      const bottleSummary =
        [];

      for (
        const bottle of
        allBottles
      ) {
        const id =
          bottle._id.toString();

        const purchased =
          purchaseQty[
            id
          ] ||
          0;

        const produced =
          bottleProduction[
            id
          ] ||
          0;

        const usedForPerfume =
          perfumeBottleUsage[
            id
          ] ||
          0;

        const soldDirectly =
          directBottleSales[
            id
          ] ||
          0;

        /*
          Wastage is negative.
        */

        const wastedChange =
          bottleWastage[
            id
          ] ||
          0;

        const wasted =
          Math.abs(
            Math.min(
              wastedChange,
              0
            )
          );

        const totalAvailable =
          purchased +
          produced;

        /*
          Correct bottle formula:

          purchased
          + produced
          - used free with perfume
          - sold as empty bottle
          - wastage
        */

        let netStock =
          totalAvailable -
          usedForPerfume -
          soldDirectly +
          wastedChange;

        if (
          netStock <
          0
        ) {
          console.warn(
            `Negative calculated bottle stock for ${bottle.sizeMl}ml ${bottle.type}. Calculated: ${netStock}`
          );

          netStock =
            0;
        }

        const costData =
          purchaseCost[
            id
          ];

        let avgCost =
          0;

        if (
          costData &&
          costData.totalQty >
            0
        ) {
          avgCost =
            costData.totalCost /
            costData.totalQty;
        }

        let changed =
          false;

        if (
          Number(
            bottle.currentStock ||
              0
          ) !==
          netStock
        ) {
          bottle.currentStock =
            netStock;

          changed =
            true;
        }

        if (
          Math.abs(
            Number(
              bottle.avgCostPerUnit ||
                0
            ) -
              avgCost
          ) >
          0.0001
        ) {
          bottle.avgCostPerUnit =
            avgCost;

          changed =
            true;
        }

        if (
          Number(
            bottle.totalPurchased ||
              0
          ) !==
          totalAvailable
        ) {
          bottle.totalPurchased =
            totalAvailable;

          changed =
            true;
        }

        const shouldStockOut =
          netStock ===
          0;

        if (
          bottle.isStockOut !==
          shouldStockOut
        ) {
          bottle.isStockOut =
            shouldStockOut;

          changed =
            true;
        }

        if (changed) {
          await bottle.save();

          bottleUpdatedCount +=
            1;
        }

        bottleSummary.push(
          {
            bottleId:
              bottle._id,

            sizeMl:
              bottle.sizeMl,

            type:
              bottle.type,

            purchased,

            produced,

            usedForPerfume,

            soldDirectly,

            wasted,

            available:
              netStock,
          }
        );

        console.log(
          `Bottle ${bottle.sizeMl}ml (${bottle.type}): ` +
            `${purchased} purchased + ` +
            `${produced} produced - ` +
            `${usedForPerfume} perfume - ` +
            `${soldDirectly} direct sales - ` +
            `${wasted} wastage = ` +
            `${netStock} available`
        );
      }

      /* ==================================
         APPLY EXISTING BLEND FIX
      ================================== */

      await applyExactBlends();

      /* ==================================
         RESPONSE
      ================================== */

      return res.json({
        message:
          'Stock rebuilt successfully. Perfume bottle usage and direct bottle sales are calculated separately.',

        updatedMaterials:
          materialUpdatedCount,

        updatedBottles:
          bottleUpdatedCount,

        totalMaterials:
          allMaterials.length,

        totalBottles:
          allBottles.length,

        brokenProducts:
          Array.from(
            brokenProducts
          ),

        bottleSummary,
      });
    } catch (error) {
      console.error(
        'Rebuild stock error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };