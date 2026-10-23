const FIXATIVE_PERCENTAGE = 3;

const OIL_PERCENTAGE_BY_SIZE = {
  6: 58,
  15: 55,
  30: 55,
  50: 55,
  100: 55,
};

function getSprayFormula(sizeMl) {
  const oil = OIL_PERCENTAGE_BY_SIZE[sizeMl];

  if (oil === undefined) {
    throw new Error(
      `No spray formula configured for ${sizeMl}ml`
    );
  }

  return {
    oil,
    ethanol: 100 - oil - FIXATIVE_PERCENTAGE,
    fixative: FIXATIVE_PERCENTAGE,
  };
}

module.exports = { getSprayFormula };