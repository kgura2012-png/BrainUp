import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
// One versioned aggregate makes economic operations and FIFO reservations atomic.
// No client can write balances or referral bindings directly.
export const siteState = sqliteTable('site_state', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
});
