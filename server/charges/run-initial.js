require("dotenv").config();
const { createInitialCharges } = require("./chargeService");

(async () => {
  try {
    const result = await createInitialCharges();
    console.log(`[charges] initial charges created: ${result.created}`);
    process.exit(0);
  } catch (error) {
    console.error("[charges] initial charge creation failed", error);
    process.exit(1);
  }
})();
