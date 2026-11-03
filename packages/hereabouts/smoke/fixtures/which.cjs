// Prints which build of the package a bundle used, from a list of input paths.
const paths = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const used = new Set(
  paths
    .filter((p) => p.includes('@billie-coop/hereabouts/'))
    .map((p) => p.match(/hereabouts\/dist\/(esm|cjs|types)/)?.[1] ?? 'other'),
);
console.log('builds used:', [...used].join(','));
