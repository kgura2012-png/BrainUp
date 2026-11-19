// Local preview/test adapter for the same prepared-query interface as D1.
import {DatabaseSync} from 'node:sqlite';
export function localDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  const operations = new WeakMap();
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let args = [];
      const run = () => ({meta:{changes:statement.run(...args).changes}});
      const query = {
        bind(...values) { args = values; return query; },
        async first() { return statement.get(...args) || null; },
        async all() { return {results:statement.all(...args)}; },
        async run() { return run(); }
      };
      operations.set(query, run);
      return query;
    },
    async batch(queries) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = queries.map(query => operations.get(query)());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
