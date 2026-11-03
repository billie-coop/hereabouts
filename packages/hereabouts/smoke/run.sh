#!/usr/bin/env bash
# Smoke test of the packed package, as an app installs it from npm:
#   - Node: require() and import of the root and subpaths
#   - Vite, webpack, esbuild: which build each picks (should be dist/esm), bundle size, and
#     that the bundle runs
#   - TypeScript with moduleResolution node (node10), node16 (CommonJS and ES module files)
#     and bundler
#
#   yarn build && packages/hereabouts/smoke/run.sh [work dir]
#
# Installs vite, webpack, esbuild and typescript from npm into a temporary directory.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${1:-$(mktemp -d)}"
APP="$WORK/app"
mkdir -p "$APP/out" "$APP/ts"

echo "work dir: $WORK"
(cd "$REPO" && yarn workspace @billie-coop/hereabouts pack -o "$WORK/hereabouts.tgz" > /dev/null)
cp "$HERE"/fixtures/*.{js,cjs,mjs} "$APP/"
cp "$HERE/fixtures/types.ts" "$HERE/fixtures/types-esm.mts" "$APP/ts/"
cd "$APP"
echo '{ "name": "smoke", "private": true, "version": "0.0.0" }' > package.json
npm install --no-audit --no-fund "$WORK/hereabouts.tgz" vite@7 webpack@5 webpack-cli@6 \
  esbuild typescript@5.9 @types/node@24 > install.log 2>&1

size() { printf '%7d bytes min, %6d gzip' "$(wc -c < "$1")" "$(gzip -9c "$1" | wc -c)"; }

echo "--- node"
printf 'require  %s\n' "$(node node-cjs.cjs)"
printf 'import   %s\n' "$(node node-esm.mjs)"

echo "--- bundlers (entry: build used, size, output)"
for e in app decimal-only; do
  node_modules/.bin/esbuild "$e.js" --bundle --minify --format=esm --platform=browser \
    --outfile="out/esbuild-$e.mjs" --metafile="out/esbuild-$e.meta.json" --log-level=warning
  used=$(node -e "console.log(JSON.stringify(Object.keys(require('./out/esbuild-$e.meta.json').inputs)))" | node which.cjs)
  printf 'esbuild %-13s %s  %s  %s\n' "$e" "$used" "$(size "out/esbuild-$e.mjs")" "$(node -r ./prelude.cjs "out/esbuild-$e.mjs")"

  node_modules/.bin/webpack --mode production --entry "./$e.js" --output-path out \
    --output-filename "webpack-$e.js" --json="out/webpack-$e.stats.json" > /dev/null 2>&1
  used=$(node -e "const ids=[];const walk=(ms)=>{for(const m of ms||[]){if(m.nameForCondition)ids.push(m.nameForCondition);walk(m.modules)}};walk(require('./out/webpack-$e.stats.json').modules);console.log(JSON.stringify(ids))" | node which.cjs)
  printf 'webpack %-13s %s  %s  %s\n' "$e" "$used" "$(size "out/webpack-$e.js")" "$(node -r ./prelude.cjs "out/webpack-$e.js")"

  cat > vite.config.mjs <<EOF
export default { logLevel: 'warn', build: { outDir: 'out/vite-$e', emptyOutDir: true, sourcemap: true,
  rollupOptions: { input: './$e.js', output: { entryFileNames: 'bundle.mjs', format: 'es' } } } };
EOF
  node_modules/.bin/vite build > "out/vite-$e.log" 2>&1
  used=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('out/vite-$e/bundle.mjs.map','utf8')).sources))" | node which.cjs)
  printf 'vite    %-13s %s  %s  %s\n' "$e" "$used" "$(size "out/vite-$e/bundle.mjs")" "$(node -r ./prelude.cjs "out/vite-$e/bundle.mjs")"
done

echo "--- typescript"
status=0
for cfg in node10:commonjs:node:types.ts node16-cjs:node16:node16:types.ts \
  node16-esm:node16:node16:types-esm.mts bundler:esnext:bundler:types.ts; do
  IFS=: read -r name mod res file <<< "$cfg"
  cat > "ts/tsconfig.$name.json" <<EOF
{ "compilerOptions": { "module": "$mod", "moduleResolution": "$res", "target": "es2022",
  "strict": true, "noEmit": true, "types": [] }, "files": ["$file"] }
EOF
  if out=$(node_modules/.bin/tsc -p "ts/tsconfig.$name.json" 2>&1); then
    printf 'tsc %-11s ok\n' "$name"
  else
    printf 'tsc %-11s FAILED\n%s\n' "$name" "$out"
    status=1
  fi
done
exit $status
