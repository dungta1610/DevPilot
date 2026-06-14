import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ReviewWorkflowInput {
  reviewRunId: string;
  prUrl: string;
  projectId: string;
}

export interface ApprovalPayload {
  approved: boolean;
  comment?: string;
}

/** A conversation turn as stored in the ProjectAssistant Virtual Object. */
export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** Snapshot returned by the DigestAgent workflow's `getStatus` shared handler. */
export interface DigestAgentStatus {
  status: string | null;
  projectId: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

/**
 * Thin client over the Restate ingress HTTP API. We call the documented ingress
 * routes directly with `fetch` rather than pulling in the Restate clients SDK or
 * importing the agent package's types — keeping the API service decoupled from
 * the agent deployment.
 */
@Injectable()
export class RestateClient {
  private readonly logger = new Logger(RestateClient.name);
  private readonly ingressUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.ingressUrl =
      config.get<string>('restate.ingressUrl') ?? 'http://localhost:8080';
    this.apiKey = config.get<string>('restate.apiKey') ?? '';
  }

  /** Auth + content-type headers; the bearer token is added only for Restate Cloud. */
  private headers(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  /**
   * Submit the keyed review workflow (key = reviewRunId). Uses the one-way
   * `/send` variant so we return immediately instead of blocking on a workflow
   * that may wait on human approval for hours. The workflow key guarantees a
   * single run per review even if this is retried.
   */
  async submitReview(input: ReviewWorkflowInput): Promise<void> {
    const url = `${this.ingressUrl}/ReviewWorkflow/${input.reviewRunId}/run/send`;
    await this.post(url, input);
  }

  /**
   * Resolve the human-approval awakeable, resuming the suspended workflow. Both
   * approve and reject resolve it (the `approved` flag carries the decision) so
   * the graph always continues gracefully rather than erroring on rejection.
   */
  async resolveApproval(
    awakeableId: string,
    payload: ApprovalPayload,
  ): Promise<void> {
    const url = `${this.ingressUrl}/restate/awakeables/${awakeableId}/resolve`;
    await this.post(url, payload);
  }

  /**
   * Invoke the workflow's `cancel` shared handler. If the review is awaiting
   * approval, this rejects it and the workflow ends cleanly.
   */
  async cancelReview(reviewRunId: string): Promise<void> {
    const url = `${this.ingressUrl}/ReviewWorkflow/${encodeURIComponent(reviewRunId)}/cancel`;
    await this.call<void>(url);
  }

  // --- Phase 3: ProjectAssistant Virtual Object (key = projectId) ---

  /**
   * Invoke the assistant's exclusive `chat` handler and wait for the reply.
   * The Virtual Object serializes concurrent messages per project, so this is
   * the only lock we need for consistent conversation history.
   */
  chat(
    projectId: string,
    input: { message: string; userId: string },
  ): Promise<AssistantMessage> {
    return this.call<AssistantMessage>(
      `${this.ingressUrl}/ProjectAssistant/${encodeURIComponent(projectId)}/chat`,
      input,
    );
  }

  getAssistantHistory(projectId: string): Promise<AssistantMessage[]> {
    return this.call<AssistantMessage[]>(
      `${this.ingressUrl}/ProjectAssistant/${encodeURIComponent(projectId)}/getHistory`,
    );
  }

  async clearAssistantHistory(projectId: string): Promise<void> {
    await this.call<void>(
      `${this.ingressUrl}/ProjectAssistant/${encodeURIComponent(projectId)}/clearHistory`,
    );
  }

  // --- Phase 3: DigestAgent workflow (workflow id = projectId) ---

  /** Submit the digest loop (fire-and-forget). One run per project key. */
  async startDigest(projectId: string): Promise<void> {
    await this.post(
      `${this.ingressUrl}/DigestAgent/${encodeURIComponent(projectId)}/run/send`,
      { projectId },
    );
  }

  getDigestStatus(projectId: string): Promise<DigestAgentStatus> {
    return this.call<DigestAgentStatus>(
      `${this.ingressUrl}/DigestAgent/${encodeURIComponent(projectId)}/getStatus`,
    );
  }

  /** Fire-and-forget / void ingress call. */
  private async post(url: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Restate ingress ${url} → ${res.status}: ${text}`);
      throw new Error(`Restate ingress call failed (${res.status})`);
    }
  }

  /**
   * Request/response ingress call that returns the handler's result. `body` is
   * omitted for no-input handlers (getHistory, getStatus, clearHistory).
   */
  private async call<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Restate ingress ${url} → ${res.status}: ${text}`);
      throw new Error(`Restate ingress call failed (${res.status})`);
    }
    const raw = await res.text();
    return (raw ? JSON.parse(raw) : undefined) as T;
  }
}
