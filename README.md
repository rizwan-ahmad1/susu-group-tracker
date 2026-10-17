# Susu Group Tracker

A small Node.js implementation of a weekly rotating savings group. Every member contributes a fixed amount in pesewas; when all contributions for a week are complete, the full pot is paid to the next member in join order.

## Requirements

- Node.js 18 or newer
- npm

## Setup and tests

```sh
npm install
npm start
```

The first run prompts for a group name and weekly contribution, then opens an interactive menu to add members, start weeks, record payments, review balances, and close funded weeks. Use menu option **6** to save and exit. Group state is saved in `data/susu-group.json` under the current project directory and restored the next time `npm start` runs. The generated `data/` directory is ignored by Git.

### CLI menu

1. **Add member** — enter a unique member ID and name. Add everyone before starting the first week.
2. **Start a week** — opens the next weekly contribution ledger.
3. **Record a payment** — enter a member ID and an amount in decimal cedis, such as `10.00`. Partial payments are supported.
4. **Show group report** — view the rotation order, each week's payments, balances still owed, and the next recipient.
5. **Close week and pay out** — closes a fully funded week and reports who receives the pot. If anyone still owes, the week remains open and the CLI displays each outstanding balance.
6. **Save and exit** — saves the current group and exits. Changes are also saved after each successful operation.

To run the automated tests:

```sh
npm test
```

## Example

```js
const { SusuGroup, parseMoneyToPesewas, formatPesewas } = require('./src');

const group = new SusuGroup('Friday Susu', parseMoneyToPesewas('25.00'));
group.addMember('ama', 'Ama');
group.addMember('kojo', 'Kojo');

group.startWeek();
group.recordPayment('ama', 2500);
group.recordPayment('kojo', 2500);

const payout = group.closeWeek();
console.log(`${payout.recipientName} receives ${formatPesewas(payout.payoutPesewas)}`);
```

The group API accepts amounts as integer pesewas. `parseMoneyToPesewas` is provided to safely convert a decimal string such as `"25.00"` at the system boundary. The report includes every week's status, contribution totals, per-member payments, outstanding balances, and the next payout recipient.

## Project layout

- `src/member.js`: validated, immutable member identity.
- `src/money.js`: exact decimal-string conversion and integer validation/formatting.
- `src/susu-group.js`: member registry, weekly ledgers, state transitions, payout rotation, and reports.
- `src/group-store.js`: JSON persistence and validated restoration of group state.
- `src/cli.js`: interactive command-line menu.
- `tests/susu.test.js`: Jest unit tests for payment rules and lifecycle behavior.

## Suggested five-commit history

1. `feat: add member, group, and exact pesewa primitives`
2. `feat: track contributions with strict validation`
3. `feat: close weeks, rotate payouts, and report balances`
4. `test: cover Susu group rules and weekly lifecycle`
5. `docs: add setup instructions and design notes`

This workspace is not currently initialized as a Git repository, so the list above is a suggested commit sequence rather than an existing commit history.
