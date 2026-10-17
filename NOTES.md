# Design Notes

## Assumptions and rules

- The weekly contribution is fixed for the lifetime of a group and is supplied in integer pesewas.
- Members are added in payout order and cannot be added after the first week starts.
- A week starts explicitly with `startWeek()`. Only one week can be open at a time.
- A member can make multiple positive partial payments during an open week. The cumulative amount cannot exceed the weekly contribution.
- Duplicate member IDs are rejected; member IDs are the stable identity used for payments.
- A week closes only when every registered member has paid exactly the required contribution.
- The payout is the fixed contribution multiplied by the number of members and goes to the next member in join order. It is recorded as a payout result; this library does not transfer money.
- Monetary strings use a dot decimal separator and at most two fractional digits. Domain methods accept safe integer pesewas rather than floating-point amounts.

## Design choices

- A `Map` keyed by member ID records each week's accumulated payment, making repeated partial contributions explicit and preventing ambiguity about which member paid.
- Each week has an open/closed state. Only a fully funded open week can transition to closed, and closing is the point at which the recipient is assigned.
- Member data and group internals are encapsulated. Reports return fresh snapshots so callers cannot mutate the ledger through returned objects.
- `WeekNotReadyError` carries a structured list of member balances due, allowing applications to present actionable feedback without parsing an error message.
- Input money conversion is deliberately string-based to avoid introducing floating-point rounding errors during parsing.
- The CLI stores one group's state in `data/susu-group.json`, restores it through the same domain validations, and saves updates via a temporary file before replacing the saved state.

## Future improvements

- Persist groups, payments, and payouts in a transactional database with audit history.
- Add payment timestamps, receipt references, reversals, and authorization/audit controls.
- Add configurable currencies and locale-aware input/output at a presentation boundary.
- Add API adapters and integration tests around persistence and payment providers.
- Define operational policies for missed payments, member withdrawals, and failed payouts.
