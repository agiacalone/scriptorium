#!/usr/bin/env node

const path = require("path");
const { loadConfig, parseCliArgs, validateConfig } = require("./lib/context");
const { ensureDir } = require("./lib/files");

const generatorPaths = {
  notes: "./generators/lecture-notes",
  "notes-md": "./generators/lecture-notes-md",
  cornell: "./generators/cornell-handout",
  "cornell-md": "./generators/cornell-handout-md",
  questions: "./generators/study-questions",
  quiz: "./generators/quiz",
  "quiz-md": "./generators/quiz-md",
  readme: "./generators/readme",
  slides: "./generators/slides",
  bank: "./generators/question-bank",
  "bank-csv": "./generators/question-bank-csv",
  exam: "./generators/exam",
};

const DEFAULT_ARTIFACTS = ["notes", "notes-md", "cornell", "cornell-md", "questions", "quiz", "quiz-md", "readme", "slides"];

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  node generate.js --config examples/lecture-spec.json [--output ./dist]",
      "  node generate.js --config lecture.json --artifact slides",
      "",
      "Artifacts:",
      "  notes, notes-md, cornell, cornell-md, questions, quiz, quiz-md, readme, slides, bank, bank-csv, exam",
      "",
      "Flags:",
      "  --config <file>    Path to lecture spec JSON",
      "  --output <dir>     Output directory (default: cwd)",
      "  --artifact <name>  Generate one artifact; repeatable",
      "  --all              Generate the standard lecture set",
      "  --help             Show this help",
      "",
      "The lecture spec provides the topic, course context, and structured content.",
    ].join("\n"),
  );
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.configPath) {
    throw new Error("Missing --config <file>. Use --help for usage.");
  }

  const config = loadConfig(args.configPath);
  validateConfig(config);

  const outputDir = path.resolve(args.outputDir || process.cwd());
  ensureDir(outputDir);

  const artifactNames = args.all || args.artifacts.length === 0 ? DEFAULT_ARTIFACTS : args.artifacts;

  for (const artifact of artifactNames) {
    const generatorPath = generatorPaths[artifact];
    if (!generatorPath) {
      throw new Error(`Unknown artifact "${artifact}".`);
    }

    const generator = require(generatorPath);
    const result = await generator.generate(config, { outputDir });
    process.stdout.write(`generated ${artifact}: ${result}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
