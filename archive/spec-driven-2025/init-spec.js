#!/usr/bin/env node

const path = require("path");
const { createSpecFromArgs, parseSpecArgs, printSpecHelp } = require("./lib/spec");
const { writeText } = require("./lib/files");
const { parsePromptToArgs } = require("./lib/prompt-parser");

function main() {
  const args = parseSpecArgs(process.argv.slice(2));
  if (args.help) {
    printSpecHelp();
    return;
  }

  let mergedArgs = args;
  if (args.prompt) {
    mergedArgs = {
      ...parsePromptToArgs(args.prompt),
      ...Object.fromEntries(Object.entries(args).filter(([, value]) => value !== "" && value !== false)),
    };
  }

  if (!mergedArgs.topic) {
    throw new Error("Missing --topic <name>. Use --help for usage.");
  }

  const spec = createSpecFromArgs(mergedArgs);
  const filePath = path.resolve(mergedArgs.output || `${spec.lecture.slug || "lecture"}-spec.json`);
  writeText(path.dirname(filePath), path.basename(filePath), `${JSON.stringify(spec, null, 2)}\n`);
  process.stdout.write(`wrote spec: ${filePath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
