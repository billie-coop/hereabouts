#!/usr/bin/env node

// The compiler runs from its TypeScript sources (and the library's, which it imports by
// relative path), so it needs no build of its own.
require('tsx/cjs');
require('../src/cli/compiler').main();
