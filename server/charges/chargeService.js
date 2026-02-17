const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CHARGE_TYPE = "MONTHLY_PAYMENT";
const PAYMENT_METHOD = "ACH";
const STATUS = "PENDING";

const startOfMonthUTC = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const firstDaySecondMonthUTC = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 1));

const toISODate = (date) => date.toISOString().slice(0, 10);

async function createInitialCharges({ dryRun = false } = {}) {
  const loans = await prisma.loan.findMany({
    where: {
      status: "FUNDED",
      fundedDate: { not: null },
      monthlyPaymentAmount: { gt: 0 },
    },
    select: {
      id: true,
      fundedDate: true,
      monthlyPaymentAmount: true,
    },
  });

  const rows = loans.map((loan) => ({
    loanId: loan.id,
    chargeType: CHARGE_TYPE,
    amount: loan.monthlyPaymentAmount,
    paymentMethod: PAYMENT_METHOD,
    dueDate: firstDaySecondMonthUTC(loan.fundedDate),
    status: STATUS,
  }));

  if (dryRun) {
    return {
      created: 0,
      preview: rows.map((row) => ({
        ...row,
        dueDate: toISODate(row.dueDate),
      })),
    };
  }

  const result = await prisma.charge.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { created: result.count };
}

async function createMonthlyCharges({ asOf = new Date(), dryRun = false } = {}) {
  const dueDate = startOfMonthUTC(asOf);

  const loans = await prisma.loan.findMany({
    where: {
      status: "FUNDED",
      monthlyPaymentAmount: { gt: 0 },
    },
    select: {
      id: true,
      monthlyPaymentAmount: true,
    },
  });

  const rows = loans.map((loan) => ({
    loanId: loan.id,
    chargeType: CHARGE_TYPE,
    amount: loan.monthlyPaymentAmount,
    paymentMethod: PAYMENT_METHOD,
    dueDate,
    status: STATUS,
  }));

  if (dryRun) {
    return {
      created: 0,
      preview: rows.map((row) => ({
        ...row,
        dueDate: toISODate(row.dueDate),
      })),
    };
  }

  const result = await prisma.charge.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { created: result.count, dueDate: toISODate(dueDate) };
}

async function withTransaction(fn) {
  return prisma.$transaction(async (tx) => fn(tx));
}

async function createInitialChargesTx({ dryRun = false } = {}) {
  return withTransaction(async (tx) => {
    const loans = await tx.loan.findMany({
      where: {
        status: "FUNDED",
        fundedDate: { not: null },
        monthlyPaymentAmount: { gt: 0 },
      },
      select: {
        id: true,
        fundedDate: true,
        monthlyPaymentAmount: true,
      },
    });

    const rows = loans.map((loan) => ({
      loanId: loan.id,
      chargeType: CHARGE_TYPE,
      amount: loan.monthlyPaymentAmount,
      paymentMethod: PAYMENT_METHOD,
      dueDate: firstDaySecondMonthUTC(loan.fundedDate),
      status: STATUS,
    }));

    if (dryRun) {
      return {
        created: 0,
        preview: rows.map((row) => ({
          ...row,
          dueDate: toISODate(row.dueDate),
        })),
      };
    }

    const result = await tx.charge.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { created: result.count };
  });
}

async function createMonthlyChargesTx({ asOf = new Date(), dryRun = false } = {}) {
  const dueDate = startOfMonthUTC(asOf);

  return withTransaction(async (tx) => {
    const loans = await tx.loan.findMany({
      where: {
        status: "FUNDED",
        monthlyPaymentAmount: { gt: 0 },
      },
      select: {
        id: true,
        monthlyPaymentAmount: true,
      },
    });

    const rows = loans.map((loan) => ({
      loanId: loan.id,
      chargeType: CHARGE_TYPE,
      amount: loan.monthlyPaymentAmount,
      paymentMethod: PAYMENT_METHOD,
      dueDate,
      status: STATUS,
    }));

    if (dryRun) {
      return {
        created: 0,
        preview: rows.map((row) => ({
          ...row,
          dueDate: toISODate(row.dueDate),
        })),
      };
    }

    const result = await tx.charge.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { created: result.count, dueDate: toISODate(dueDate) };
  });
}

module.exports = {
  createInitialCharges: createInitialChargesTx,
  createMonthlyCharges: createMonthlyChargesTx,
};
