import { Octokit } from '@octokit/rest';
import { TerminalError } from '@restatedev/restate-sdk';
import { config } from '../../config';
import type { PrMetadata } from '../state';

const PR_URL_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

export interface ParsedPr {
  owner: string;
  repo: string;
  pullNumber: number;
}

/** Parse a PR URL, or throw a non-retryable error (a bad URL never succeeds). */
export function parsePrUrl(prUrl: string): ParsedPr {
  const match = PR_URL_RE.exec(prUrl);
  if (!match) {
    throw new TerminalError(`Invalid GitHub PR URL: ${prUrl}`);
  }
  return { owner: match[1], repo: match[2], pullNumber: Number(match[3]) };
}

function octokit(): Octokit {
  return new Octokit({ auth: config.githubToken });
}

/**
 * Translate an Octokit error into the right Restate failure mode:
 *  - 404 / 401 / 403 are **terminal** — a missing/private PR or bad credentials
 *    will never succeed by retrying, so don't waste attempts or quota.
 *  - everything else (5xx, rate limit, network) is left as a regular Error, so
 *    Restate retries with backoff.
 */
function classifyGithubError(error: unknown, prUrl: string): never {
  const status = (error as { status?: number }).status;
  if (status === 404) {
    throw new TerminalError(
      `PR not found or repository is private: ${prUrl}`,
      { errorCode: 404 },
    );
  }
  if (status === 401 || status === 403) {
    throw new TerminalError(
      'GitHub authentication failed — check GITHUB_APP_TOKEN.',
      { errorCode: 401 },
    );
  }
  throw error as Error;
}

export interface FetchedPr {
  prDiff: string;
  prTitle: string;
  prMetadata: PrMetadata;
}

/** Fetch PR metadata and unified diff. */
export async function fetchPullRequest(prUrl: string): Promise<FetchedPr> {
  const { owner, repo, pullNumber } = parsePrUrl(prUrl);
  const gh = octokit();

  try {
    const [pr, diff] = await Promise.all([
      gh.pulls.get({ owner, repo, pull_number: pullNumber }),
      gh.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: { format: 'diff' },
      }),
    ]);

    return {
      // With `format: diff`, the response body is the raw diff string.
      prDiff: diff.data as unknown as string,
      prTitle: pr.data.title,
      prMetadata: {
        owner,
        repo,
        pullNumber,
        author: pr.data.user?.login,
        baseBranch: pr.data.base.ref,
        changedFiles: pr.data.changed_files,
        additions: pr.data.additions,
        deletions: pr.data.deletions,
      },
    };
  } catch (error) {
    classifyGithubError(error, prUrl);
  }
}

/** Post the synthesized review as an issue comment on the PR. Returns its id. */
export async function postReviewComment(
  meta: PrMetadata,
  body: string,
): Promise<number> {
  const gh = octokit();
  try {
    const { data } = await gh.issues.createComment({
      owner: meta.owner,
      repo: meta.repo,
      issue_number: meta.pullNumber,
      body,
    });
    return data.id;
  } catch (error) {
    classifyGithubError(
      error,
      `${meta.owner}/${meta.repo}#${meta.pullNumber}`,
    );
  }
}
