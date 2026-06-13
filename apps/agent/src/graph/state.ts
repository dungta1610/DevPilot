import { Annotation } from '@langchain/langgraph';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  file?: string;
  line?: number;
  description: string;
  suggestion: string;
  severity: Severity;
}

export interface AgentResult {
  issues: Issue[];
  summary: string;
  severity: Severity;
}

export interface ReviewReport {
  qualityScore: number; // 0-100
  securityScore: number;
  perfScore: number;
  overallSummary: string;
  markdownComment: string; // formatted for GitHub
  totalIssues: number;
}

export interface PrMetadata {
  owner: string;
  repo: string;
  pullNumber: number;
  author?: string;
  baseBranch?: string;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
}

export interface ApprovalDecision {
  approved: boolean;
  comment?: string;
}

/** Replace-on-write reducer — the last node to set a field wins. */
const replace = <T>() => ({
  reducer: (_prev: T, next: T) => next,
  default: () => null as T,
});

/**
 * LangGraph state. The three specialist agents run in parallel and each writes
 * its own distinct field, so a simple replace reducer is conflict-free at fan-in.
 */
export const ReviewStateAnnotation = Annotation.Root({
  // Input
  reviewRunId: Annotation<string>(),
  prUrl: Annotation<string>(),
  projectId: Annotation<string>(),

  // Fetched PR data
  prDiff: Annotation<string>(replace<string>()),
  prTitle: Annotation<string>(replace<string>()),
  prMetadata: Annotation<PrMetadata | null>(replace<PrMetadata | null>()),

  // Parallel sub-agent results
  qualityResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),
  securityResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),
  perfResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),

  // Final synthesis
  synthesis: Annotation<ReviewReport | null>(replace<ReviewReport | null>()),

  // Human approval
  approvalDecision: Annotation<ApprovalDecision | null>(
    replace<ApprovalDecision | null>(),
  ),
});

export type ReviewState = typeof ReviewStateAnnotation.State;
