/**
 * Tax Rate — reads tax_rate from site_settings or env
 */

export async function getTaxRate(db, env) {
  if (env && env.TAX_RATE) {
    var envRate = parseFloat(env.TAX_RATE);
    if (!isNaN(envRate) && envRate >= 0 && envRate <= 1) return envRate;
  }
  try {
    var row = await db.prepare("SELECT value FROM site_settings WHERE key = 'tax_rate'").first();
    if (row && row.value) {
      var rate = parseFloat(row.value);
      if (!isNaN(rate) && rate >= 0 && rate <= 1) return rate;
    }
  } catch (_) {}
  return 0;
}
