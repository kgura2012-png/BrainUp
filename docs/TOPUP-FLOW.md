# Top-up forms and admin operations

New Stars invoices credit 1.25 BU per Star, from 1 Star. `support_payments.bu_rate` pins the rate on creation. Schema migration assigns 135 cents to old invoices; their receipt status and refunds retain the original value. Telegram's verified webhook remains the only Stars credit authority.

UAH applications accept a custom amount from 1 to 1,000,000 hryvnias, up to two decimal places, at 1.25 BU per hryvnia rounded to 0.01 BU. The owner configures only a receiving card number under Admin → Top-ups. The card is omitted from all public configuration. New applications contain no card. Only the owner can reveal the currently configured number into a specific application's immutable snapshot. Only the corresponding user and owner can read it.

States: `new` → owner reveals card → `ready` → user marks payment → `checking` → owner verifies actual receipt → `ok` or `no`. User assertions alone never credit balances. Before payment is marked, the user may cancel. Waiting/revealed requests expire in 30 minutes; marked requests allow 24 hours for review. Terminal requests cannot be credited again. The database CAS and action receipt cover wallet changes and request state together. Admins should approve only after checking the transfer in their bank.

Brainrot top-ups show one normal card per family. The corner mutation button chooses a supported variation and transfers the current family's selected quantity to that variation. Game nickname and bonus code appear together below the catalog. Admin top-up credit values and enabled flags are persisted using `admin-topup-settings`; the application uses those server-owned values and rejects disabled items. New deposit volume does not book a separate partner commission.

Admin fixes retain the brainrot settings sub-tab, retry catalog saves that collide with another request, show save failures, persist counters, resolve partner owners by stable ID/username/name, accept common image formats, and allow case contents larger than the old 500-item limit. Existing nonredeemable game behavior and disabled external withdrawal actions remain in place.
