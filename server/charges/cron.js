require("dotenv").config();
const cron = require("node-cron");
const { createMonthlyCharges } = require("./chargeService");

const schedule = process.env.MONTHLY_CHARGE_CRON || "0 2 1 * *";
const timezone = process.env.CRON_TZ || "UTC";

cron.schedule(
  schedule,
  async () => {
    try {
      const result = await createMonthlyCharges();
      console.log(
        `[charges] monthly charges created: ${result.created} (due ${result.dueDate})`
      );
    } catch (error) {
      console.error("[charges] monthly charge creation failed", error);
    }
  },
  { timezone }
);

console.log(
  `[charges] scheduler started (cron=${schedule}, tz=${timezone})`
);
