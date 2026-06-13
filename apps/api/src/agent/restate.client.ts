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

  constructor(config: ConfigService) {
    this.ingressUrl =
      config.get<string>('restate.ingressUrl') ?? 'http://localhost:8080';
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

  private async post(url: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Restate ingress ${url} → ${res.status}: ${text}`);
      throw new Error(`Restate ingress call failed (${res.status})`);
    }
  }
}
