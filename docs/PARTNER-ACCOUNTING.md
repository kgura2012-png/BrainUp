# Partner game results

For newly settled games, partner commission in BU is `(stake - payout) * current partner percentage / 100`. The server values all consumed and awarded inventory items at its catalog price and includes coin change. A 100 BU stake with a 200 BU payout at 10% posts -10 BU. Negative pending balances carry forward; partner claims require a positive pending balance.

Top-ups track deposit volume without a separate commission. Selling a prize does not settle another game. Existing pending/paid balances remain the opening balances; historical games are not recalculated. Admin rate changes affect subsequent settlements only. Disabled partners do not accrue new game entries.

Cases, upgrades, Dice and Fuse settle on the server result. Mines retain the reserved stake until loss or cash-out and settle once. A later Fuse boss trophy is an additional zero-stake award. Legacy Rocket is not an active mode. Only the current game’s returned payout enters the margin; unrelated wallet changes never affect it.

Each partner retains up to 200 recent game ledger entries with referred user, mode, timestamp, stake, payout, margin, percentage and signed commission. The owner can inspect the latest 30 in the admin panel. Partner totals and referred-player totals remain cumulative. Only the owner and the corresponding partner receive the ledger; other players receive the public partner projection.

Game changes and partner adjustments share the existing database CAS write and action receipt. Stars receipt processing records volume in the same state write as the credited wallet and reverses recorded volume once on a verified refund. The Stars exchange rate is 1.25 BU per Star, from 1 to 10,000 Stars.

New Stars invoices store their exchange rate. Older invoices retain 1.35 BU per Star for receipt status and exact refunds. Manual UAH deposits use 1.25 BU per hryvnia; only approved bank-transfer requests track volume.
