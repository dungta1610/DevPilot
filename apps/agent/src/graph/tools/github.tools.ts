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

export interface FetchedPr {
  prDiff: string;
  prTitle: string;
  prMetadata: PrMetadata;
}

/** Fetch PR metadata and unified diff. */
export async function fetchPullRequest(prUrl: string): Promise<FetchedPr> {
  const { owner, repo, pullNumber } = parsePrUrl(prUrl);
  const gh = octokit();

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
}

/** Post the synthesized review as an issue comment on the PR. Returns its id. */
export async function postReviewComment(
  meta: PrMetadata,
  body: string,
): Promise<number> {
  const gh = octokit();
  const { data } = await gh.issues.createComment({
    owner: meta.owner,
    repo: meta.repo,
    issue_number: meta.pullNumber,
    body,
  });
  return data.id;
}
