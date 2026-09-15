#!/usr/bin/env node
import { run } from './run.js';
import { processOutput } from './runtime/output.js';

process.exitCode = await run(process.argv.slice(2), processOutput);
