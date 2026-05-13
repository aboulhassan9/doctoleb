import { execFileSync } from 'node:child_process';

const DEFAULT_REPO = 'aboulhassan9/doctoleb';
const DEFAULT_BRANCH = 'main';
const DEFAULT_INTERVAL_MS = 15000;

function parseArgs(argv) {
  const options = {
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    intervalMs: DEFAULT_INTERVAL_MS,
    runId: null,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length);
    } else if (arg.startsWith('--branch=')) {
      options.branch = arg.slice('--branch='.length);
    } else if (arg.startsWith('--interval=')) {
      options.intervalMs = Number(arg.slice('--interval='.length)) * 1000;
    } else if (!arg.startsWith('--') && !options.runId) {
      options.runId = arg;
    }
  }

  if (!Number.isFinite(options.intervalMs) || options.intervalMs < 3000) {
    options.intervalMs = DEFAULT_INTERVAL_MS;
  }

  return options;
}

function runGh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString?.().trim();
    throw new Error(stderr || error.message || 'GitHub CLI command failed.');
  }
}

function readJsonFromGh(args) {
  const output = runGh(args);
  return JSON.parse(output);
}

function resolveLatestRunId({ repo, branch }) {
  const runs = readJsonFromGh([
    'run',
    'list',
    '--repo',
    repo,
    '--branch',
    branch,
    '--limit',
    '1',
    '--json',
    'databaseId',
  ]);

  const latest = runs[0];
  if (!latest?.databaseId) {
    throw new Error(`No GitHub Actions runs found for ${repo} on ${branch}.`);
  }

  return String(latest.databaseId);
}

function readRun({ repo, runId }) {
  return readJsonFromGh([
    'run',
    'view',
    runId,
    '--repo',
    repo,
    '--json',
    'status,conclusion,jobs,url,displayTitle,headBranch',
  ]);
}

function summarizeJob(job) {
  if (job.status === 'completed') {
    return `${symbolForConclusion(job.conclusion)} ${job.name}`;
  }

  return `* ${job.name}`;
}

function symbolForConclusion(conclusion) {
  if (conclusion === 'success') return '✓';
  if (conclusion === 'skipped') return '-';
  if (conclusion === 'cancelled') return '!';
  return '✗';
}

function summarizeRun(run) {
  const jobs = run.jobs || [];
  const completed = jobs.filter((job) => job.status === 'completed');
  const active = jobs.filter((job) => job.status !== 'completed');
  const failed = completed.filter((job) => !['success', 'skipped'].includes(job.conclusion));
  const successful = completed.filter((job) => job.conclusion === 'success');

  const headline = `${run.status}${run.conclusion ? `/${run.conclusion}` : ''} | ${successful.length}/${jobs.length} jobs passed`;
  const activeText = active.length ? ` | active: ${active.map((job) => job.name).join(', ')}` : '';
  const failedText = failed.length ? ` | failed: ${failed.map((job) => job.name).join(', ')}` : '';

  return `${headline}${activeText}${failedText}`;
}

function printFinal(run) {
  const conclusion = run.conclusion || 'unknown';
  console.log(`\n${symbolForConclusion(conclusion)} ${run.displayTitle || 'GitHub Actions run'} finished: ${conclusion}`);
  console.log(run.url);

  for (const job of run.jobs || []) {
    console.log(`  ${summarizeJob(job)}`);
  }
}

function printHelp() {
  console.log(`Usage:
  npm run ci:watch
  npm run ci:watch -- <run-id>
  npm run ci:watch -- --branch=main --interval=15

Options:
  --repo=owner/name      GitHub repository. Default: ${DEFAULT_REPO}
  --branch=name         Branch for latest-run lookup. Default: ${DEFAULT_BRANCH}
  --interval=seconds    Poll interval. Default: ${DEFAULT_INTERVAL_MS / 1000}
`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const runId = options.runId || resolveLatestRunId(options);
  console.log(`Watching GitHub Actions run ${runId} (${options.repo})`);

  let lastSummary = '';
  let finalRun = null;

  while (!finalRun) {
    const run = readRun({ repo: options.repo, runId });
    const summary = summarizeRun(run);

    if (summary !== lastSummary) {
      console.log(summary);
      lastSummary = summary;
    }

    if (run.status === 'completed') {
      finalRun = run;
      break;
    }

    await sleep(options.intervalMs);
  }

  printFinal(finalRun);
  if (finalRun.conclusion !== 'success') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`CI watch failed: ${error.message}`);
  process.exitCode = 1;
});
