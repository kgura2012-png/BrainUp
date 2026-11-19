// Local preview/test adapter for the same prepared-query interface as D1.
import {DatabaseSync} from 'node:sqlite';
export function localDatabase(filename=':memory:') {
  const sqlite=new DatabaseSync(filename);
  return {
    sqlite,
    prepare(sql) {
      const stmt=sqlite.prepare(sql);let args=[];
      const query={bind(...values){args=values;return query},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return {meta:{changes:r.changes}}}};
      return query;
    }
  };
}
