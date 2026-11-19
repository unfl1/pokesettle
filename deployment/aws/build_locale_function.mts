import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = process.argv[2];
if (!source) throw new Error('Expected a TypeScript CloudFront function source');
process.stdout.write(stripTypeScriptTypes(readFileSync(source, 'utf8')));
