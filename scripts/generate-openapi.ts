import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/adapters/inbound/http/api/openapi.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'docs/openapi.json');

const document = buildOpenApiDocument();
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

process.stdout.write(`Wrote ${outputPath}\n`);
