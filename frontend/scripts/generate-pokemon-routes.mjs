import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.CATALOG_DIR ?? path.resolve(root, '../data');
const records = JSON.parse(fs.readFileSync(path.join(source, 'pokemon.json'), 'utf8'));
const names = JSON.parse(fs.readFileSync(path.join(source, 'pokemon_names.json'), 'utf8')).items;
const ids = new Set(records.map(item => item.pokemon_id));
if (ids.size !== names.length || names.some(item => !ids.delete(item.pokemon_id)) || ids.size) throw new Error('Catalogue/route snapshot mismatch');
const routes = names.map(({ pokemon_id, names, slugs }) => ({ pokemonId: pokemon_id, names, slugs }));
for (const locale of ['ko', 'en', 'ja', 'zh']) {
  const paths = routes.map(item => `${item.slugs[locale]}-${item.pokemonId.split(':')[1]}`);
  if (paths.some(item => item.startsWith('undefined-') || item.startsWith('-')) || new Set(paths).size !== routes.length) throw new Error(`Invalid routes: ${locale}`);
}
fs.mkdirSync(path.join(root, 'src/generated'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/generated/pokemon-routes.json'), JSON.stringify(routes) + '\n');
console.log(`Validated ${routes.length} Pokémon route entries`);
