// Runs API Extractor once per entry point in package.json's export map, writing
// etc/hereabouts.api.md for the root and etc/hereabouts-<subpath>.api.md for each subpath.
// API Extractor reads one entry point per config, so this derives the per-entry settings from
// etc/api-extractor.json instead of keeping one config file per subpath.
//
//   node scripts/api.mjs           fails if a report differs from the committed one (CI)
//   node scripts/api.mjs --local   updates the reports
//
// Build first: the reports are made from dist/types.
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonFullPath = join(root, 'package.json');
const configObjectFullPath = join(root, 'etc', 'api-extractor.json');
const pkg = require(packageJsonFullPath);
const localBuild = process.argv.includes('--local');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

let failed = 0;
for (const [key, value] of Object.entries(pkg.exports)) {
  if (typeof value !== 'object' || !value.types) {
    continue;
  }
  const sub = key === '.' ? '' : key.slice(2);
  const name = sub ? `hereabouts-${sub}` : 'hereabouts';
  if (only.length && !only.includes(sub || '.')) {
    continue;
  }
  const configObject = ExtractorConfig.loadFile(configObjectFullPath);
  configObject.mainEntryPointFilePath = `<projectFolder>/${value.types}`;
  configObject.apiReport = { ...configObject.apiReport, reportFileName: `${name}.api.md` };
  configObject.docModel = {
    ...configObject.docModel,
    apiJsonFilePath: `<projectFolder>/temp/${name}.api.json`,
  };
  const config = ExtractorConfig.prepare({
    configObject,
    configObjectFullPath,
    packageJsonFullPath,
  });
  const result = Extractor.invoke(config, { localBuild, showVerboseMessages: false });
  const status = result.succeeded ? 'ok' : 'FAILED';
  console.log(
    `${status.padEnd(6)} ${key.padEnd(18)} etc/${name}.api.md` +
      `${result.apiReportChanged ? ' (changed)' : ''}` +
      ` errors ${result.errorCount}, warnings ${result.warningCount}`,
  );
  if (!result.succeeded) {
    failed++;
  }
}
process.exit(failed ? 1 : 0);
