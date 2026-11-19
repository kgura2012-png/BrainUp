import fs from 'node:fs/promises';
import path from 'node:path';
import {expandMutationCatalog} from '../shared/mutations.mjs';

export async function synchronizeMutations(root){
 const file=path.join(root,'server/seed.json'),seed=JSON.parse(await fs.readFile(file,'utf8'));
 const bases=JSON.parse(await fs.readFile(path.join(root,'assets/mutations/bases.json'),'utf8'));
 const normal=seed.items.filter(item=>!item.mutation),variants=expandMutationCatalog(normal,bases);
 const ids=new Set(normal.map(item=>item.id));for(const variant of variants){if(ids.has(variant.id))throw Error('Mutation ID collision');ids.add(variant.id)}
 seed.items=normal.concat(variants);const serialized=JSON.stringify(seed)+'\n';if(await fs.readFile(file,'utf8')!==serialized)await fs.writeFile(file,serialized);
 return seed;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await synchronizeMutations(process.cwd());
