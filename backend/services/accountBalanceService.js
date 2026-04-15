const { Op } = require("sequelize");
const db = require("../models");

const toRoundedBalance = (value) => Number(Number(value || 0).toFixed(2));

const normalizeAccountIds = (accountIds = []) =>
  [...new Set(accountIds)]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

const buildBalanceMap = async (accountIds, options = {}) => {
  const normalizedAccountIds = normalizeAccountIds(accountIds);

  if (!normalizedAccountIds.length) {
    return new Map();
  }

  const rows = await db.Transaction.findAll({
    attributes: [
      "accountId",
      [
        db.sequelize.literal(`COALESCE(
          SUM(
            CASE
              WHEN "type" IN ('cash-in', 'credit') THEN "amount"
              WHEN "type" IN ('cash-out', 'debit') THEN -"amount"
              ELSE 0
            END
          ),
          0
        )`),
        "balance",
      ],
    ],
    where: {
      accountId: {
        [Op.in]: normalizedAccountIds,
      },
    },
    group: ["accountId"],
    raw: true,
    transaction: options.transaction,
  });

  return rows.reduce((balanceMap, row) => {
    balanceMap.set(Number(row.accountId), toRoundedBalance(row.balance));
    return balanceMap;
  }, new Map());
};

const recalculateAccountBalances = async (accountIds, options = {}) => {
  const normalizedAccountIds = normalizeAccountIds(accountIds);

  if (!normalizedAccountIds.length) {
    return;
  }

  const [balancesByAccountId, accounts] = await Promise.all([
    buildBalanceMap(normalizedAccountIds, options),
    db.Account.findAll({
      attributes: ["id", "openingBalance"],
      where: {
        id: {
          [Op.in]: normalizedAccountIds,
        },
      },
      raw: true,
      transaction: options.transaction,
    }),
  ]);

  const openingBalanceByAccountId = accounts.reduce((map, account) => {
    map.set(Number(account.id), toRoundedBalance(account.openingBalance));
    return map;
  }, new Map());

  await Promise.all(
    normalizedAccountIds.map((accountId) =>
      db.Account.update(
        {
          balance: toRoundedBalance(
            toRoundedBalance(openingBalanceByAccountId.get(accountId) || 0) +
              toRoundedBalance(balancesByAccountId.get(accountId) || 0)
          ),
        },
        {
          where: { id: accountId },
          transaction: options.transaction,
        }
      )
    )
  );
};

const recalculateAllAccountBalances = async (options = {}) => {
  const accounts = await db.Account.findAll({
    attributes: ["id"],
    raw: true,
    transaction: options.transaction,
  });

  await recalculateAccountBalances(
    accounts.map((account) => account.id),
    options
  );
};

module.exports = {
  recalculateAccountBalances,
  recalculateAllAccountBalances,
};
