# DevPilot Agent

# PHẦN 0 — Bức tranh tổng thể

Trước khi đọc bất kỳ dòng code nào, cần hiểu **service này làm gì**.

Đây là một HTTP server. Nó không phải web server thông thường — nó là một
**Restate service**. Nghĩa là: Restate server (chạy riêng) gọi vào nó, và nó
chạy các "durable handler" — các hàm được Restate đảm bảo không mất tiến độ
khi crash.

Trong service này có **3 thứ** (gọi chung là "agents"):

1. **ReviewWorkflow** — nhận PR URL, review code bằng AI, chờ người duyệt, post comment
2. **ProjectAssistant** — chat hỏi đáp về project, nhớ lịch sử hội thoại
3. **DigestAgent** — mỗi 24h tự tóm tắt hoạt động của project

Cả 3 dùng chung một bộ hạ tầng: Gemini (LLM), GitHub API, và một loạt helper.

**Luồng một request review:**

```
NestJS → Restate server → index.ts → reviewWorkflow.run()
                                          ↓
                                    review-graph.ts (LangGraph)
                                          ↓
                                    chạy 8 nodes lần lượt
                                          ↓
                                    mỗi node gọi withStep()
                                          ↓
                                    withStep gọi ctx.run() + notify
                                          ↓
                            ctx.run gọi ra ngoài: Gemini / GitHub / NestJS
```

---

# PHẦN 1 — Nền móng: 4 file khởi động

Bắt đầu từ những file đơn giản nhất, không có logic AI.

## 1.1 — `load-env.ts` (10 dòng)

```typescript
// Nạp biến môi trường từ file .env vào process.env
```

Đây chỉ là bước nạp config từ file `.env`. Được import đầu tiên trong
`index.ts` (dòng `import './load-env'`) để đảm bảo mọi biến môi trường sẵn sàng
trước khi code khác chạy.

**Khái niệm:** Biến môi trường (environment variables) là cách lưu config nhạy
cảm (API key, URL) bên ngoài code. Không hardcode key vào source.

## 1.2 — `config.ts` (43 dòng) — Lazy getter pattern

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  agentPort: Number(process.env.AGENT_PORT ?? 9080),

  // ↓ Đây là điểm tinh tế: GETTER, không phải value
  get googleApiKey(): string {
    return required('GOOGLE_API_KEY');
  },
  get githubToken(): string {
    return required('GITHUB_APP_TOKEN');
  },
};
```

**Tại sao dùng `get` (getter) thay vì giá trị thường?**

Nếu viết `googleApiKey: required('GOOGLE_API_KEY')` (giá trị thường), thì ngay
khi file `config.ts` được load, nó sẽ kiểm tra biến này. Nếu thiếu → crash
ngay lúc khởi động.

Nhưng với `get googleApiKey()` (getter), việc kiểm tra chỉ xảy ra **khi có ai
đó thật sự đọc** `config.googleApiKey`. Nghĩa là server có thể khởi động và
đăng ký với Restate kể cả khi chưa có Gemini key — key chỉ cần thiết khi một
node thật sự gọi Gemini.

**Bài học:** Lazy evaluation — chỉ làm việc khi thật sự cần. Comment trong code
nói rõ: *"Values are read lazily so the HTTP server can boot even when optional
credentials are absent."*

## 1.3 — `health.ts` (23 dòng)

```typescript
// Một HTTP server nhỏ riêng biệt, cổng 9081
// Chỉ trả về { status: "ok" } để Railway/Restate biết service còn sống
```

**Khái niệm:** Health check — một endpoint đơn giản để hệ thống bên ngoài
(load balancer, orchestrator) kiểm tra "service này còn chạy không?". Tách
riêng cổng 9081 để không lẫn với cổng Restate (9080).

## 1.4 — `index.ts` (30 dòng) — Điểm khởi đầu

```typescript
import './load-env';              // 1. Nạp env trước tiên
import * as restate from '@restatedev/restate-sdk';
import { reviewWorkflow } from './restate/review-workflow';
import { projectAssistant } from './restate/project-assistant';
import { digestAgent } from './restate/digest-agent';

restate
  .endpoint()
  .bind(reviewWorkflow)    // 2. Đăng ký 3 services
  .bind(projectAssistant)
  .bind(digestAgent)
  .listen(config.agentPort)  // 3. Lắng nghe cổng 9080
  .then((port) => {
    console.log(`agent listening on :${port}`);
    startHealthServer();     // 4. Bật health check
  });
```

**Đây là toàn bộ "bootstrap" của service.** Nó nói với Restate: "tôi có 3
services này, hãy gọi vào tôi qua cổng 9080". Sau khi `listen` xong, ta chạy
lệnh `register` (riêng) để báo Restate server biết địa chỉ của service này.

**Khái niệm cốt lõi:** `.bind()` đăng ký một durable service. `endpoint()` là
HTTP server mà Restate SDK tạo ra. Restate server (Docker) sẽ gọi vào đây.

---

# PHẦN 2 — AI Agent là gì? (Khái niệm nền tảng)

Trước khi đọc code agent, phải hiểu agent khác chatbot thế nào.

**Chatbot:** User hỏi → LLM trả lời text → hết. Một vòng.

**Agent:** LLM được trao **tools** (công cụ) — khả năng thực hiện hành động.
LLM tự quyết định gọi tool nào, khi nào, bao nhiêu lần.

```
Chatbot:   User → LLM → text

Agent:     User → LLM → "tôi cần gọi tool X"
                  → [tool X chạy, trả kết quả]
                  → LLM → "giờ cần tool Y"
                  → [tool Y chạy, trả kết quả]
                  → LLM → "đủ rồi, đây là câu trả lời"
```

Trong project này có **2 kiểu agent**:

**Kiểu 1 — Pipeline cố định (ReviewWorkflow):** Các bước được định nghĩa sẵn
theo một graph. fetch_pr → orchestrator → 3 agents song song → synthesizer →
approval → post. LLM không tự quyết định flow — flow đã được vẽ sẵn.

**Kiểu 2 — ReAct tự quyết (ProjectAssistant):** LLM tự quyết định gọi tool nào
dựa trên câu hỏi. Không có flow cố định. "Reason + Act" — suy luận rồi hành động.

---

# PHẦN 3 — LangGraph: công cụ vẽ flow cho agent

## 3.1 — Khái niệm: State, Node, Edge

LangGraph là thư viện để xây agent dạng **graph** (đồ thị). 3 khái niệm:

- **State (trạng thái):** Một "túi dữ liệu" được truyền qua tất cả các bước.
  Mỗi bước đọc từ túi và ghi vào túi.
- **Node (nút):** Một bước xử lý. Nhận state, làm gì đó, trả về phần state cập nhật.
- **Edge (cạnh):** Mũi tên nối các node, quy định thứ tự chạy.

## 3.2 — `graph/state.ts` (79 dòng) — Định nghĩa cái túi dữ liệu

```typescript
import { Annotation } from '@langchain/langgraph';

// Các kiểu dữ liệu
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

// Reducer "replace": node nào ghi sau cùng thì giá trị đó thắng
const replace = <T>() => ({
  reducer: (_prev: T, next: T) => next,
  default: () => null as T,
});

// ĐÂY là cái túi dữ liệu
export const ReviewStateAnnotation = Annotation.Root({
  // Input ban đầu
  reviewRunId: Annotation<string>(),
  prUrl: Annotation<string>(),
  projectId: Annotation<string>(),

  // fetch_pr ghi vào đây
  prDiff: Annotation<string>(replace<string>()),
  prTitle: Annotation<string>(replace<string>()),
  prMetadata: Annotation<PrMetadata | null>(replace<PrMetadata | null>()),

  // 3 agents ghi kết quả vào đây
  qualityResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),
  securityResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),
  perfResult: Annotation<AgentResult | null>(replace<AgentResult | null>()),

  // synthesizer ghi vào đây
  synthesis: Annotation<ReviewReport | null>(replace<ReviewReport | null>()),

  // human_approval ghi vào đây
  approvalDecision: Annotation<ApprovalDecision | null>(...),
});
```

**Câu hỏi quan trọng: tại sao cần `reducer`?**

Khi 3 agents (quality, security, perf) chạy **song song**, chúng cùng ghi vào
state cùng lúc. LangGraph cần biết: khi 2 node ghi vào cùng một lúc, làm sao
merge?

Reducer `(_prev, next) => next` nghĩa là "lấy giá trị mới". Vì mỗi agent ghi
vào **field riêng** (quality ghi `qualityResult`, security ghi `securityResult`),
không có xung đột thật. Comment giải thích: *"each writes its own distinct
field, so a simple replace reducer is conflict-free at fan-in."*

**Bài học:** State trong LangGraph không phải biến thường — nó cần reducer để
xử lý ghi đồng thời từ nhiều node song song.

## 3.3 — `graph/review-graph.ts` (64 dòng) — Vẽ flow

```typescript
import { END, START, StateGraph } from '@langchain/langgraph';

// Hàm quyết định đi đâu sau approval
function approvalRouter(state: ReviewState): 'post_comment' | typeof END {
  return state.approvalDecision?.approved ? 'post_comment' : END;
}

export async function runReviewGraph(ctx, input) {
  const graph = new StateGraph(ReviewStateAnnotation)
    // Khai báo các node — mỗi node nhận ctx (Restate) + state (LangGraph)
    .addNode('fetch_pr', (s) => fetchPrNode(ctx, s))
    .addNode('orchestrator', (s) => orchestratorNode(ctx, s))
    .addNode('quality_agent', (s) => qualityAgentNode(ctx, s))
    .addNode('security_agent', (s) => securityAgentNode(ctx, s))
    .addNode('perf_agent', (s) => perfAgentNode(ctx, s))
    .addNode('synthesizer', (s) => synthesizerNode(ctx, s))
    .addNode('human_approval', (s) => humanApprovalNode(ctx, s))
    .addNode('post_comment', (s) => postCommentNode(ctx, s))

    // Khai báo edges — thứ tự chạy
    .addEdge(START, 'fetch_pr')
    .addEdge('fetch_pr', 'orchestrator')

    // Fan-out: 1 node → 3 node chạy SONG SONG
    .addEdge('orchestrator', 'quality_agent')
    .addEdge('orchestrator', 'security_agent')
    .addEdge('orchestrator', 'perf_agent')

    // Fan-in: 3 node → 1 node (synthesizer chờ cả 3 xong)
    .addEdge('quality_agent', 'synthesizer')
    .addEdge('security_agent', 'synthesizer')
    .addEdge('perf_agent', 'synthesizer')
    .addEdge('synthesizer', 'human_approval')

    // Conditional edge: rẽ nhánh dựa trên kết quả approval
    .addConditionalEdges('human_approval', approvalRouter, {
      post_comment: 'post_comment',
      [END]: END,
    })
    .addEdge('post_comment', END)
    .compile();

  return graph.invoke(input);
}
```

**Đọc graph này như đọc bản đồ:**
- START → fetch_pr → orchestrator
- orchestrator tỏa ra 3 nhánh song song (fan-out)
- 3 nhánh gộp lại ở synthesizer (fan-in)
- synthesizer → human_approval
- Tại human_approval: nếu approve → post_comment → END; nếu không → END

**Khái niệm "fan-out/fan-in":** Một pattern phổ biến — chia việc ra nhiều
worker chạy song song (fan-out), rồi gộp kết quả lại (fan-in). Tiết kiệm thời
gian vì 3 agents chạy cùng lúc thay vì tuần tự.

**Điểm tinh tế:** Mỗi node được wrap `(s) => fetchPrNode(ctx, s)`. Tại sao?
Vì LangGraph chỉ truyền `state` cho node, nhưng node cần cả `ctx` của Restate
để journal. Closure này "tiêm" ctx vào mỗi node. ĐÂY là chỗ LangGraph và
Restate gặp nhau.

---

# PHẦN 4 — Hạ tầng dùng chung (thư mục lib/)

Trước khi đọc từng node, phải hiểu các helper mà mọi node dùng.

## 4.1 — `lib/notify.ts` (81 dòng) — Báo tiến độ cho UI

```typescript
async function post(path: string, body: unknown): Promise<void> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(`${config.apiInternalUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': config.apiInternalSecret,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      if (attempt === attempts) {
        console.warn(`[notify] ${path} → ${res.status} (gave up)`);
        return;  // ← BỎ CUỘC, không throw
      }
    } catch (err) {
      if (attempt === attempts) {
        console.warn(`[notify] ${path} failed`);
        return;  // ← BỎ CUỘC, không throw
      }
    }
    await new Promise((r) => setTimeout(r, attempt * 200));
  }
}

export async function notifyStep(reviewRunId, agentName, status, output, durationMs) {
  await post(`/internal/reviews/${reviewRunId}/steps`, { agentName, status, ... });
}
```

**Triết lý quan trọng:** Hàm này là "best-effort" (cố gắng hết sức nhưng không
đảm bảo). Nếu gọi NestJS thất bại → **nuốt lỗi, không throw**.

T��i sao? Vì việc này chỉ để cập nhật UI. Comment nói rõ: *"a failed ping must
never fail the review."* Nếu update UI lỗi mà làm sập cả review thì vô lý — UI
chỉ thiếu một frame animation thôi.

Lưu ý: các hàm notify này được gọi **NGOÀI** `ctx.run` — chúng không phải phần
của durable computation, chỉ là kênh phụ báo cho UI.

## 4.2 — `lib/internal-api.ts` (55 dòng) — Lấy data cho LLM

```typescript
export async function getInternal<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiInternalUrl}${path}`, {
    headers: { 'x-internal-secret': config.apiInternalSecret },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Internal API GET ${path} → ${res.status}: ${text}`);
    // ↑ PHẢI throw — ngược với notify.ts
  }
  return (await res.json()) as T;
}
```

**So sánh với notify.ts — đây là điểm thiết kế tinh tế nhất:**

| | notify.ts | internal-api.ts |
|---|---|---|
| Mục đích | Cập nhật UI | Lấy data feed cho LLM |
| Khi lỗi | Nuốt lỗi, đi tiếp | Throw, để retry |
| Nằm ở đâu | Ngoài ctx.run | Trong ctx.run |

T��i sao khác? Nếu lấy data cho LLM mà thất bại nhưng nuốt lỗi → LLM sẽ phân
tích trên data rỗng/sai → kết quả review sai. Nên phải throw để Restate retry.

**Bài học lớn:** Cùng là "gọi HTTP đến NestJS", nhưng 2 mục đích khác nhau →
2 cách xử lý lỗi khác nhau. Đây là tư duy phân biệt mức độ nghiêm trọng.

## 4.3 — `lib/retry.ts` (25 dòng) — Chính sách thử lại

```typescript
// LLM: rate limit (429) cần kiên nhẫn → backoff dài
export const LLM_RETRY = {
  maxRetryAttempts: 5,
  initialRetryInterval: 2000,   // bắt đầu 2 giây
  maxRetryInterval: 60000,      // tối đa 60 giây
  retryIntervalFactor: 2,       // gấp đôi mỗi lần: 2s, 4s, 8s...
};

// GitHub: lỗi 5xx/network thường nhanh hết → backoff ngắn
export const GITHUB_RETRY = {
  maxRetryAttempts: 4,
  initialRetryInterval: 1000,
  maxRetryInterval: 30000,
  retryIntervalFactor: 2,
};
```

**Khái niệm "exponential backoff":** Khi thử lại, đợi ngày càng lâu — 2s, 4s,
8s, 16s. Tránh dồn dập gọi lại liên tục làm quá tải. Gemini hay bị rate limit
nên cần đợi lâu hơn GitHub.

Khi hết `maxRetryAttempts`, `ctx.run` ném ra `TerminalError` — tức là lỗi dai
dẳng cuối cùng cũng được báo ra, không retry mãi mãi.

## 4.4 — `lib/step.ts` (53 dòng) — withStep, abstraction trung tâm

Đây là helper **quan trọng nhất** của toàn bộ pipeline.

```typescript
export async function withStep<T>(
  ctx, reviewRunId, stepName,
  action: () => Promise<T>,       // việc thật sự cần làm
  summarize?,                     // tóm tắt kết quả cho UI
  runOptions?,                    // chính sách retry
): Promise<T> {
  // BƯỚC 1: báo UI "đang chạy"
  await notifyStep(reviewRunId, stepName, 'RUNNING');
  const startedAt = Date.now();

  try {
    // BƯỚC 2: chạy việc trong ctx.run → được Restate journal
    const result = runOptions
      ? await ctx.run(stepName, action, runOptions)
      : await ctx.run(stepName, action);

    // BƯỚC 3: báo UI "xong" + thời gian chạy
    await notifyStep(
      reviewRunId, stepName, 'COMPLETED',
      summarize ? summarize(result) : null,
      Date.now() - startedAt,
    );
    return result;
  } catch (err) {
    // BƯỚC 4: báo UI "lỗi" rồi ném lại để Restate retry
    await notifyStep(reviewRunId, stepName, 'FAILED', {
      error: (err as Error).message,
    });
    throw err;
  }
}
```

**Tại sao đây là abstraction quan trọng nhất?**

Mọi node trong pipeline đều cần làm 4 việc: báo RUNNING → chạy việc (journal) →
báo COMPLETED → nếu lỗi báo FAILED. Thay vì copy-paste 4 bước này vào 8 node,
ta gói vào `withStep`. Một node giờ chỉ còn vài dòng.

**Bài học DRY (Don't Repeat Yourself):** Tách "cái chung" (durability +
progress reporting) khỏi "cái riêng" (logic mỗi node). Khi cần đổi cách báo
tiến độ, chỉ sửa 1 chỗ thay vì 8 chỗ.

## 4.5 — `lib/parse-llm-json.ts` (46 dòng) — Đọc JSON từ LLM

```typescript
export function parseLLMJson<T>(content: unknown, context: string): T {
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');

  // Chiến lược 1: parse trực tiếp
  try {
    return JSON.parse(text) as T;
  } catch { /* thử cách khác */ }

  // Chiến lược 2: bỏ ```json ... ``` (markdown fence)
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch { /* thử cách khác */ }

  // Chiến lược 3: tìm khối {...} hoặc [...] đầu tiên
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try {
      return JSON.parse(match[1]) as T;
    } catch { /* bỏ cuộc */ }
  }

  // Tất cả thất bại → throw Error THƯỜNG (không phải TerminalError)
  throw new Error(`Failed to parse LLM JSON output in ${context}...`);
}
```

**Vấn đề thực tế:** Gemini đôi khi trả về JSON nhưng bọc trong ```json ... ```,
hoặc thêm một câu giải thích trước. Code thử 3 cách từ chặt đến lỏng.

**Điểm tinh tế:** Khi thất bại hoàn toàn, ném `Error` THƯỜNG (retryable), không
phải `TerminalError`. Vì sao? Comment giải thích: *"a retry with the same prompt
may well return valid JSON."* Gemini chạy lại có thể trả JSON đúng. Nên để
Restate retry.

---

# PHẦN 5 — Boundary: gọi ra thế giới bên ngoài

## 5.1 — `llm/gemini.ts` (19 dòng) — Tạo model Gemini

```typescript
export function buildGeminiModel(temperature = 0.1): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL,        // 'gemini-2.5-flash'
    apiKey: config.googleApiKey,
    temperature,                // độ "sáng tạo" — thấp = ổn định
    maxRetries: 3,              // LangChain tự retry trước khi Restate retry
    maxOutputTokens: 8192,
  });
}
```

**Khái niệm "temperature":** Số từ 0 đến 1 điều chỉnh độ ngẫu nhiên của LLM.
Thấp (0.1) = trả lời ổn định, ít sáng tạo — tốt cho JSON có cấu trúc. Cao
(0.7+) = sáng tạo, đa dạng — tốt cho viết văn.

**2 tầng retry:** `maxRetries: 3` là LangChain tự retry khi Gemini lỗi tạm
thời. Nếu vẫn lỗi, ctx.run (bao bên ngoài) sẽ retry tiếp theo LLM_RETRY policy.
Nghĩa là hầu hết lỗi nhỏ được nuốt ở tầng LangChain, không tốn journal entry.

## 5.2 — `graph/tools/github.tools.ts` (113 dòng) — Gọi GitHub

```typescript
const PR_URL_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

// Phân tích URL, hoặc throw nếu URL sai (không bao giờ đúng được)
export function parsePrUrl(prUrl: string): ParsedPr {
  const match = PR_URL_RE.exec(prUrl);
  if (!match) {
    throw new TerminalError(`Invalid GitHub PR URL: ${prUrl}`);
  }
  return { owner: match[1], repo: match[2], pullNumber: Number(match[3]) };
}

// ĐÂY là hàm phân loại lỗi — tập trung 1 chỗ, dùng chung
function classifyGithubError(error: unknown, prUrl: string): never {
  const status = (error as { status?: number }).status;

  // 404: PR không tồn tại → retry vô ích → TerminalError
  if (status === 404) {
    throw new TerminalError(`PR not found or repository is private: ${prUrl}`,
      { errorCode: 404 });
  }
  // 401/403: sai credentials → retry vô ích → TerminalError
  if (status === 401 || status === 403) {
    throw new TerminalError('GitHub authentication failed — check token.',
      { errorCode: 401 });
  }
  // Còn lại (5xx, network, rate limit) → Error thường → Restate retry
  throw error as Error;
}

export async function fetchPullRequest(prUrl: string): Promise<FetchedPr> {
  const { owner, repo, pullNumber } = parsePrUrl(prUrl);
  const gh = octokit();
  try {
    // Gọi GitHub 2 lần song song: lấy metadata + lấy diff
    const [pr, diff] = await Promise.all([
      gh.pulls.get({ owner, repo, pull_number: pullNumber }),
      gh.pulls.get({ owner, repo, pull_number: pullNumber,
        mediaType: { format: 'diff' } }),  // format diff = trả về raw diff string
    ]);
    return { prDiff: diff.data, prTitle: pr.data.title, prMetadata: {...} };
  } catch (error) {
    classifyGithubError(error, prUrl);  // dùng hàm phân loại chung
  }
}
```

**Khái niệm "TerminalError vs Error" (đây là điểm Restate quan trọng nhất):**

- `TerminalError` = "đừng retry, sẽ không bao giờ thành công". URL sai, PR
  không tồn tại, sai mật khẩu — retry vô ích.
- `Error` thường = "retry đi, có thể thành công". Network timeout, server lỗi
  tạm thời (5xx), rate limit — đợi một lúc rồi thử lại được.

Phân loại sai = hoặc tốn tiền/thời gian retry vô ích, hoặc bỏ cuộc quá sớm khi
đáng lẽ retry được. Hàm `classifyGithubError` tập trung logic này vào 1 chỗ,
dùng cho cả fetch và post.

---

# PHẦN 6 — Các node của review pipeline

Giờ ta đã có đủ nền để đọc từng node. Đọc theo độ phức tạp tăng dần.

## 6.1 — `nodes/fetch-pr.ts` (31 dòng) — Node đơn giản nhất, không LLM

```typescript
export async function fetchPrNode(ctx, state): Promise<Partial<ReviewState>> {
  const fetched = await withStep(
    ctx,
    state.reviewRunId,
    'fetch_pr',
    () => fetchPullRequest(state.prUrl),       // việc cần làm
    (r) => ({                                   // tóm tắt cho UI
      lines: r.prDiff.split('\n').length,
      files: r.prMetadata.changedFiles ?? 0,
    }),
    GITHUB_RETRY,                               // chính sách retry
  );
  return {
    prDiff: fetched.prDiff,
    prTitle: fetched.prTitle,
    prMetadata: fetched.prMetadata,
  };
}
```

**Đọc node này:** Nó gọi `withStep` (báo tiến độ + journal), bên trong gọi
`fetchPullRequest` (lấy data GitHub). Trả về phần state cần cập nhật (3 field).

Vì có `withStep`, node này tự động: báo UI "fetch_pr đang chạy" → lấy PR →
journal kết quả → báo UI "xong, 847 dòng, 12 file". Toàn bộ chỉ trong 1 lời
gọi withStep.

**Đây là node tốt nhất để bắt đầu** vì không có LLM — dễ verify đúng/sai.

## 6.2 — `nodes/orchestrator.ts` (33 dòng) — LLM nhưng nhẹ

```typescript
export async function orchestratorNode(ctx, state): Promise<Partial<ReviewState>> {
  await withStep(
    ctx, state.reviewRunId, 'orchestrator',
    async () => {
      const model = buildGeminiModel(0.2);
      const res = await model.invoke([
        new HumanMessage(
          `Briefly note the scope and risk areas of this PR in one sentence.
          Title: ${state.prTitle}
          Diff preview: ${state.prDiff.slice(0, 2000)}`,
        ),
      ]);
      return typeof res.content === 'string' ? res.content : '';
    },
    () => ({ routedTo: 3 }),  // UI hiển thị "Routed to 3 agents"
  );
  return {};  // KHÔNG thay đổi state
}
```

**Điểm đáng chú ý:** Node này gọi Gemini nhưng kết quả **không quan trọng** —
nó `return {}` (không đổi state). Vai trò chính là tạo một ghi chú ngắn về
phạm vi PR (cho logging) và phát sự kiện "orchestrator" cho UI.

3 agents luôn chạy (đã định trong graph edges), orchestrator không quyết định
routing. Comment xác nhận: *"All three specialists always run (fan-out is via
graph edges)."*

## 6.3 — `nodes/analysis-agent.ts` (90 dòng) — Base chung cho 3 agents

Đây là file then chốt — 3 agents (quality, security, perf) đều dùng nó.

```typescript
const MAX_DIFF_CHARS = 50_000;

// Cắt diff quá lớn để không vượt context window của Gemini
function truncateDiff(diff: string): string {
  return diff.length > MAX_DIFF_CHARS
    ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n…(diff truncated)…`
    : diff;
}

// Ép kết quả LLM về đúng shape, kể cả khi thiếu field
function normalize(raw: Partial<AgentResult>): AgentResult {
  const issues: Issue[] = Array.isArray(raw.issues) ? raw.issues : [];
  const severity = raw.severity && SEVERITIES.includes(raw.severity)
    ? raw.severity : 'low';
  return {
    issues,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    severity,
  };
}

export function runAnalysisAgent(ctx, state, spec: AnalysisAgentSpec): Promise<AgentResult> {
  return withStep(
    ctx, state.reviewRunId, spec.stepName,
    async () => {
      const model = buildGeminiModel(0.1);
      const response = await model.invoke([
        new SystemMessage(spec.systemPrompt),    // system prompt khác nhau mỗi agent
        new HumanMessage(
          `Review this PR diff:\n\nTitle: ${state.prTitle}\n\n${truncateDiff(state.prDiff)}`,
        ),
      ]);
      try {
        return normalize(parseLLMJson(response.content, spec.stepName));
      } catch {
        // Parse thất bại → trả kết quả rỗng, KHÔNG làm sập review
        return {
          issues: [],
          summary: 'The analyzer could not produce structured output.',
          severity: 'low',
        };
      }
    },
    spec.outputSummary,
    LLM_RETRY,
  );
}

// Hướng dẫn JSON schema, gắn vào cuối mỗi system prompt
export const JSON_SCHEMA_INSTRUCTION = `Respond ONLY with valid JSON matching...`;
```

**Đây là nơi 3 khái niệm gặp nhau:**
1. `truncateDiff` — bảo vệ context window (LLM có giới hạn input)
2. `normalize` — defensive programming, không tin output LLM
3. fallback trong catch — graceful degradation, 1 agent lỗi không giết cả review

**Khái niệm "context window":** LLM chỉ đọc được một lượng text giới hạn. Diff
quá lớn (>50,000 ký tự) sẽ bị cắt. Đây là giới hạn thực tế phải xử lý.

## 6.4 — `nodes/quality-agent.ts` (31 dòng) — Một agent cụ thể

```typescript
const SYSTEM_PROMPT = `You are an expert code reviewer focused on code quality...
- Code smells and anti-patterns
- Naming conventions and readability issues
- Missing error handling
...
${JSON_SCHEMA_INSTRUCTION}`;

export async function qualityAgentNode(ctx, state): Promise<Partial<ReviewState>> {
  const qualityResult = await runAnalysisAgent(ctx, state, {
    stepName: 'quality_agent',
    systemPrompt: SYSTEM_PROMPT,
    outputSummary: (r) => ({ issues: r.issues.length }),
  });
  return { qualityResult };
}
```

**Toàn bộ file chỉ có thế.** Vì logic chung nằm trong `runAnalysisAgent`, agent
cụ thể chỉ cần: (1) system prompt riêng, (2) tên step, (3) field trả về.

`security-agent.ts` và `perf-agent.ts` GIỐNG HỆT, chỉ khác system prompt:
- Security: tập trung OWASP, secrets, SQL injection, XSS
- Perf: tập trung N+1 query, memory leak, bundle size

**Bài học:** Khi nhiều thứ gần giống nhau, tách phần chung ra base, phần riêng
truyền qua tham số. Đây là lý do 3 agents chỉ tốn ~30 dòng mỗi cái thay vì ~90.

## 6.5 — `nodes/synthesizer.ts` (97 dòng) — Gộp kết quả + fallback

```typescript
const SYSTEM_PROMPT = `You are synthesizing the results from three specialized
code-review agents into a single GitHub PR review...`;

// Report dự phòng nếu LLM fail — tự ghép từ data, KHÔNG cần LLM
function fallbackReport(state: ReviewState): ReviewReport {
  const total = totalIssues(state.qualityResult, state.securityResult, state.perfResult);
  const section = (title: string, r: AgentResult | null): string => {
    if (!r || r.issues.length === 0) return `### ${title}\n\nNo issues found.\n`;
    const bullets = r.issues.map((i) =>
      `- ${i.file ? `\`${i.file}\`${i.line ? `:${i.line}` : ''} — ` : ''}${i.description}`
    ).join('\n');
    return `### ${title}\n\n${r.summary}\n\n${bullets}\n`;
  };
  return {
    qualityScore: 0, securityScore: 0, perfScore: 0,
    overallSummary: `Automated review found ${total} issue(s)...`,
    markdownComment: [
      '# DevPilot review', '',
      section('Quality', state.qualityResult),
      section('Security', state.securityResult),
      section('Performance', state.perfResult),
    ].join('\n'),
    totalIssues: total,
  };
}

export async function synthesizerNode(ctx, state): Promise<Partial<ReviewState>> {
  const synthesis = await withStep(
    ctx, state.reviewRunId, 'synthesizer',
    async () => {
      const model = buildGeminiModel(0.2);
      const res = await model.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(JSON.stringify({
          quality: state.qualityResult,
          security: state.securityResult,
          performance: state.perfResult,
        })),
      ]);
      try {
        const parsed = parseLLMJson<ReviewReport>(res.content, 'synthesizer');
        return { ...parsed, totalIssues: totalIssues(...) };
      } catch {
        return fallbackReport(state);  // LLM fail → dùng report tự ghép
      }
    },
    () => ({ sections: 3 }),
    LLM_RETRY,
  );
  return { synthesis };
}
```

**Vai trò:** Nhận 3 kết quả (quality, security, perf), nhờ Gemini gộp thành 1
report hoàn chỉnh với điểm số và markdown comment đẹp.

**Điểm tinh tế — 2 tầng phòng thủ:**
1. `parseLLMJson` thử 3 cách đọc JSON
2. Nếu vẫn fail → `fallbackReport` tự ghép markdown từ data thô, không cần LLM

Nghĩa là dù Gemini hỏng hoàn toàn, user vẫn nhận được một report cơ bản từ data
3 agents đã thu thập. Không bao giờ trả về tay trắng.

## 6.6 — `nodes/human-approval.ts` (54 dòng) — Trái tim của Restate

Đây là node quan trọng nhất để hiểu Restate.

```typescript
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 giờ

export async function humanApprovalNode(ctx, state): Promise<Partial<ReviewState>> {
  // Tạo "awakeable" — một lời hứa bền vững (durable promise)
  // Nó sống sót qua crash, restart — vì lưu trong Restate, không trong RAM
  const approval = ctx.awakeable<ApprovalDecision>();

  // Lưu id vào state để handler cancel có thể resolve nó khi đang chờ
  ctx.set('awakeableId', approval.id);

  await notifyStep(state.reviewRunId, 'human_approval', 'RUNNING');
  // Báo UI: đang chờ duyệt, kèm nội dung review để hiển thị
  await notifyAwaitingApproval(
    state.reviewRunId,
    approval.id,
    state.synthesis?.markdownComment ?? '',
  );

  // ĐUA giữa 2 thứ: người duyệt HOẶC hết 24h
  const decision = await RestatePromise.race([
    approval.promise,                              // người bấm Approve/Reject
    ctx.sleep(APPROVAL_TIMEOUT_MS).map(() => ({    // hoặc 24h trôi qua
      approved: false,
      comment: 'Auto-rejected: approval timed out after 24h',
    })),
  ]);

  ctx.clear('awakeableId');  // dọn dẹp khi đã có quyết định

  await notifyStep(state.reviewRunId, 'human_approval',
    decision.approved ? 'COMPLETED' : 'SKIPPED',
    { decision: decision.approved ? 'approved' : 'rejected' });

  return { approvalDecision: decision };
}
```

**Khái niệm "awakeable" (lời hứa bền vững):**

`ctx.awakeable()` tạo ra 2 thứ: một `id` và một `promise`. Promise này "treo"
— code dừng tại `await approval.promise` cho đến khi có ai đó (từ bên ngoài)
gọi resolve với `id` đó.

Điểm kỳ diệu: trong lúc treo, workflow **SUSPEND** — không tốn CPU, RAM. Có thể
treo hàng giờ, hàng ngày. Khi người dùng bấm Approve trên UI → NestJS gọi
Restate resolve awakeable → promise hoàn thành → workflow tiếp tục.

Và vì awakeable lưu trong Restate (không phải RAM), server có thể restart nhiều
lần trong lúc chờ mà không mất gì.

**Khái niệm "race" (đua):** `RestatePromise.race` chạy 2 thứ song song, lấy cái
nào xong trước. Ở đây: hoặc người duyệt trả lời, hoặc 24h trôi qua (auto-reject).
`ctx.sleep` cũng là durable — đếm 24h kể cả khi server restart.

**Tại sao lưu `awakeableId` vào state?** Để handler `cancel` (xem phần 7) có
thể đọc id này và resolve awakeable với `approved: false` khi user muốn hủy
review đang chờ duyệt. Đây là cách 2 handler giao tiếp.

## 6.7 — `nodes/post-comment.ts` (35 dòng) — Node cuối

```typescript
export async function postCommentNode(ctx, state): Promise<Partial<ReviewState>> {
  await withStep(
    ctx, state.reviewRunId, 'post_comment',
    async () => {
      if (!state.prMetadata || !state.synthesis) {
        throw new TerminalError('Missing PR metadata or synthesis before post');
      }
      const commentId = await postReviewComment(
        state.prMetadata,
        state.synthesis.markdownComment,
      );
      return { commentId };
    },
    (r) => ({ commentId: r.commentId }),
    GITHUB_RETRY,
  );
  return {};
}
```

**Chỉ chạy khi approve** (nhờ conditional edge trong graph). Post markdown
comment lên GitHub PR.

**Điểm Restate quan trọng:** Vì nằm trong `ctx.run` (qua withStep), nếu crash
SAU KHI đã post comment, lúc replay sẽ KHÔNG post lại. Comment xác nhận: *"a
crash after the comment is posted will NOT double-post on replay."* Đây là lý
do tách post_comment thành node riêng — để journal entry của nó độc lập, đảm
bảo không double-post.

---

# PHẦN 7 — Restate primitives: 3 services

Giờ ta hiểu các node, hãy xem 3 service "bọc" chúng.

## 7.1 — `restate/review-workflow.ts` (67 dòng) — Workflow + cancel

```typescript
export const reviewWorkflow = restate.workflow({
  name: 'ReviewWorkflow',
  handlers: {
    // Handler chính — chạy graph
    run: async (ctx, input): Promise<ReviewResultSummary> => {
      try {
        const final = await runReviewGraph(ctx, input);  // chạy LangGraph
        const approved = final.approvalDecision?.approved ?? false;
        const status = approved ? 'completed' : 'rejected';
        await notifyCompleted(input.reviewRunId, status);
        return { reviewRunId: input.reviewRunId, status };
      } catch (err) {
        // Chỉ báo "failed" cho UI nếu là TerminalError
        // Lỗi retryable thì Restate đang retry, không nên báo failed
        if (err instanceof restate.TerminalError) {
          await notifyCompleted(input.reviewRunId, 'failed', err.message);
        }
        throw err;
      }
    },

    // Handler cancel — thêm handler MỚI là thay đổi an toàn (version-safe)
    cancel: restate.handlers.workflow.shared(
      async (ctx): Promise<void> => {
        const awakeableId = await ctx.get<string>('awakeableId');
        if (awakeableId) {
          // Nếu đang chờ duyệt, resolve với reject → workflow đi nhánh "rejected"
          ctx.resolveAwakeable<ApprovalDecision>(awakeableId, {
            approved: false,
            comment: 'Cancelled by user',
          });
        }
      },
    ),
  },
});
```

**Khái niệm "workflow":** Một loại Restate service chạy ĐÚNG MỘT LẦN cho mỗi
id. Workflow id ở đây = reviewRunId. Nếu submit 2 lần cùng reviewRunId, lần 2
không tạo run mới mà bám vào run đang chạy. Đây là idempotency miễn phí.

**Khái niệm "shared handler":** Handler `cancel` là "shared" — nó chạy được
song song với `run`, và không sửa state của workflow (chỉ đọc). Nhưng nó vẫn
resolve được awakeable. Đây là cách hủy một workflow đang treo chờ duyệt.

**Điểm về xử lý lỗi:** Trong catch, chỉ báo "failed" cho UI khi là
`TerminalError`. Vì lỗi retryable nghĩa là Restate đang retry — báo "failed"
lúc đó là sai, review chưa thật sự thất bại.

## 7.2 — `restate/project-assistant.ts` (83 dòng) — Virtual Object

```typescript
const HISTORY_LIMIT = 20;

export const projectAssistant = restate.object({
  name: 'ProjectAssistant',
  handlers: {
    // Handler "exclusive" (mặc định) — chạy MỘT-CÁI-MỘT-LÚC per key
    chat: async (ctx, input): Promise<ChatMessage> => {
      // TerminalError: tin nhắn rỗng là lỗi client, retry vô ích
      if (!input.message?.trim()) {
        throw new restate.TerminalError('Message cannot be empty', { errorCode: 400 });
      }

      // ctx.key = projectId. Đọc lịch sử từ K/V store của Restate
      const history = (await ctx.get<ChatMessage[]>('history')) ?? [];
      const recent = history.slice(-HISTORY_LIMIT);

      // Journal kết quả LLM — crash không gọi lại (không tốn tiền)
      const reply = await ctx.run(
        'assistant_llm',
        () => runAssistantGraph(ctx.key, recent, input.message),
        LLM_RETRY,
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant', content: reply, timestamp: new Date().toISOString(),
      };

      // Ghi lịch sử lại vào K/V store — tự động persist
      ctx.set('history', [
        ...recent,
        { role: 'user', content: input.message, timestamp: ... },
        assistantMessage,
      ]);

      return assistantMessage;
    },

    // Handler "shared" — đọc, chạy song song, không block hàng đợi chat
    getHistory: restate.handlers.object.shared(
      async (ctx): Promise<ChatMessage[]> =>
        (await ctx.get<ChatMessage[]>('history')) ?? [],
    ),

    clearHistory: async (ctx): Promise<void> => {
      ctx.clear('history');
    },
  },
});
```

**Khái niệm "Virtual Object":** Khác workflow (chạy một lần rồi xong), Virtual
Object là một "thực thể" sống mãi mãi, có state riêng theo key. Key ở đây =
projectId. Mỗi project có một "hộp" K/V store riêng để lưu lịch sử chat.

**Khái niệm "exclusive vs shared handler":**
- `chat` là exclusive (mặc định) — Restate đảm bảo chỉ MỘT `chat` chạy tại một
  thời điểm cho cùng một projectId. Nếu 2 user gửi tin nhắn cùng lúc, cái thứ 2
  chờ cái thứ nhất xong. Nhờ vậy lịch sử không bị ghi đè lẫn nhau.
- `getHistory` là shared — đọc thôi, chạy song song được, không chặn hàng đợi.

**Đây là điểm mạnh lớn:** Không cần Redis lock hay database lock để tránh race
condition. Virtual Object cho điều đó miễn phí. Comment nói: *"two users sending
at once must not race the history → writes serialize for free. No Redis lock,
no Postgres advisory lock."*

## 7.3 — `restate/digest-agent.ts` (120 dòng) — Durable sleep

```typescript
const DIGEST_INTERVAL_MS = Number(process.env.DIGEST_INTERVAL_MS ?? 24 * 60 * 60 * 1000);

export const digestAgent = restate.workflow({
  name: 'DigestAgent',
  handlers: {
    run: async (ctx, input): Promise<void> => {
      ctx.set('status', 'running');
      ctx.set('projectId', input.projectId);

      // Vòng lặp VÔ HẠN — chạy mãi cho project này
      while (true) {
        ctx.set('lastRunAt', new Date().toISOString());

        // Kiểm tra project còn tồn tại không
        let exists = true;
        try {
          exists = await ctx.run('check_project',
            () => checkProjectExists(input.projectId),
            { maxRetryAttempts: 5 });
        } catch (err) {
          // Không xác định được (API lỗi) → coi như "một ngày xấu", thử lại sau
          ctx.set('lastError', ...);
          await ctx.sleep(DIGEST_INTERVAL_MS);
          continue;  // ← bỏ qua chu kỳ này, lặp tiếp
        }
        if (!exists) {
          // Project bị xóa → DỪNG HẲN vòng lặp
          ctx.set('status', 'stopped');
          return;  // ← kết thúc workflow
        }

        try {
          // Tạo digest + lưu — đều journal
          const digest = await ctx.run('generate_digest',
            () => generateDigest(input.projectId), LLM_RETRY);
          await ctx.run('save_digest',
            () => postInternal(`/internal/projects/${input.projectId}/digests`,
              { content: digest }), { maxRetryAttempts: 5 });
          ctx.set('lastSuccessAt', new Date().toISOString());
        } catch (err) {
          // Một ngày xấu không nên giết vòng lặp → log rồi đi tiếp
          ctx.set('lastError', ...);
        }

        // DURABLE SLEEP — không phải setTimeout
        // Timer này sống trong Restate, không trong RAM
        await ctx.sleep(DIGEST_INTERVAL_MS);
        // Code tiếp tục tại đây sau 24h, kể cả khi server restart nhiều lần
      }
    },

    getStatus: restate.handlers.workflow.shared(async (ctx) => ({...})),
  },
});
```

**Khái niệm "durable sleep":** `ctx.sleep(24h)` KHÔNG phải `setTimeout`.
setTimeout lưu timer trong RAM của Node.js — server restart là mất. `ctx.sleep`
lưu timer trong Restate server — process có thể chết và sống lại bao nhiêu lần,
timer vẫn đếm đúng và kích hoạt đúng giờ.

Nghĩa là vòng lặp `while(true)` này thay thế HOÀN TOÀN cron job. Không cần
node-cron, không cần AWS EventBridge.

**Điểm tinh tế nhất — phân biệt 3 kiểu kết thúc:**
1. Project bị xóa → `return` → dừng workflow vĩnh viễn
2. API lỗi tạm thời (không check được) → `continue` → bỏ qua chu kỳ, thử lại sau
3. Tạo digest lỗi → `catch` rồi đi tiếp → vòng lặp vẫn sống

Comment giải thích rõ vì sao không gộp: project bị xóa là tín hiệu DUY NHẤT nên
dừng hẳn, khác với "một ngày xấu" (transient) phải tiếp tục.

---

# PHẦN 8 — Phần Assistant (chi tiết)

## 8.1 — `graph/assistant/assistant-graph.ts` (86 dòng) — ReAct agent

```typescript
const ASSISTANT_SYSTEM_PROMPT = `You are DevPilot Assistant...
Always call the tools to fetch real data before answering — never invent...`;

export async function runAssistantGraph(projectId, history, userMessage): Promise<string> {
  const model = buildGeminiModel(0.3);

  // 3 tools, mỗi cái "khóa" projectId trong closure
  const tools = [
    getTasksTool(projectId),
    getReviewsTool(projectId),
    getStatsTool(projectId),
  ];

  // createReactAgent = agent tự quyết định gọi tool nào (LangGraph dựng sẵn)
  const agent = createReactAgent({ llm: model, tools, prompt: ASSISTANT_SYSTEM_PROMPT });

  // Chuyển lịch sử thành định dạng message của LangChain
  const messages = [
    ...history.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
    new HumanMessage(userMessage),
  ];

  const result = await agent.invoke({ messages });
  const text = messageText(result.messages.at(-1));  // lấy tin nhắn cuối
  return text || "I couldn't generate a response for that. Try rephrasing?";
}
```

**Khái niệm "ReAct agent":** "Reason + Act". Agent này không có flow cố định.
LLM nhận câu hỏi, tự quyết định: "cần gọi tool nào?" → gọi → đọc kết quả →
"cần gọi tiếp không?" → cho đến khi đủ thông tin trả lời.

`createReactAgent` là agent dựng sẵn của LangGraph — tự lo vòng lặp reason-act.
Ta chỉ cần cung cấp: model, tools, system prompt.

**Khác biệt cốt lõi với ReviewWorkflow:** ReviewWorkflow có graph cố định (ta
vẽ từng edge). ProjectAssistant để LLM tự quyết định flow. Hai kiểu agent khác
nhau hoàn toàn.

## 8.2 — `graph/assistant/assistant-tools.ts` (80 dòng) — Định nghĩa tools

```typescript
export function getTasksTool(projectId: string) {
  return tool(
    async ({ status, priority }) => {        // hàm thực thi tool
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const data = await getInternal(
        `/internal/projects/${projectId}/tasks?${params.toString()}`);
      return JSON.stringify(data);            // trả về JSON string cho LLM
    },
    {
      name: 'get_tasks',
      description: 'Get tasks for this project. Optionally filter by status...',
      schema: z.object({                      // schema mô tả tham số cho LLM
        status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE']).optional()
          .describe('Filter by task status'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional()
          .describe('Filter by priority'),
      }),
    },
  );
}
```

**Khái niệm "tool":** Một hàm mà LLM có thể gọi. Gồm 3 phần:
1. Hàm thực thi (làm việc thật — ở đây gọi NestJS lấy tasks)
2. `name` + `description` — để LLM biết tool này làm gì, khi nào dùng
3. `schema` (dùng Zod) — mô tả tham số, LLM dựa vào đây để gọi đúng

**Điểm tinh tế — closure khóa projectId:** Mỗi tool factory nhận `projectId` và
"khóa" nó trong closure. Nghĩa là LLM KHÔNG cần (và không thể) cung cấp
projectId — nó chỉ chọn filter (status, priority). Comment giải thích: *"the
LLM never has to supply (or could spoof) the project scope."* Đây là bảo mật:
LLM không thể truy cập project khác.

**Khái niệm "Zod schema":** Zod là thư viện mô tả và kiểm tra kiểu dữ liệu.
`z.enum([...])` nói với LLM "tham số này chỉ nhận các giá trị này". LLM dùng mô
tả này để gọi tool đúng cách.

## 8.3 — `graph/digest/digest-graph.ts` (47 dòng) — Digest đơn giản

```typescript
const DIGEST_PROMPT = `You are generating a daily activity digest...`;

export async function generateDigest(projectId: string): Promise<string> {
  // Lấy 3 nguồn data song song
  const [tasks, reviews, stats] = await Promise.all([
    getInternal(`/internal/projects/${projectId}/tasks?updatedSince=24h`),
    getInternal(`/internal/projects/${projectId}/reviews?completedSince=24h`),
    getInternal(`/internal/projects/${projectId}/stats`),
  ]);

  const model = buildGeminiModel(0.4);

  // MỘT lời gọi LLM duy nhất — không cần graph, không cần tools
  const response = await model.invoke([
    new SystemMessage(DIGEST_PROMPT),
    new HumanMessage(JSON.stringify({ tasks, reviews, stats, generatedAt: ... })),
  ]);

  return typeof response.content === 'string' ? response.content : ...;
}
```

**Điểm quan trọng:** DigestAgent KHÔNG dùng LangGraph. Vì task đủ đơn giản —
chỉ là "lấy data, nhờ LLM tóm tắt". Một lời gọi `model.invoke` là đủ.

**Bài học cuối:** Không phải agent nào cũng cần LangGraph. LangGraph chỉ cần khi:
(1) có nhiều bước với điều kiện rẽ nhánh (ReviewWorkflow), hoặc
(2) LLM cần tự gọi tool lặp lại (ProjectAssistant).
Task đơn giản (DigestAgent) → một LLM call thẳng, gọn hơn nhiều.

---

# PHẦN 9 — Tổng kết: các tầng và nguyên tắc

## Kiến trúc 5 tầng (mỗi tầng chỉ phụ thuộc tầng dưới)

```
T��ng 1: Restate primitives    review-workflow, project-assistant, digest-agent
T��ng 2: Graph logic           review-graph, assistant-graph, digest-graph
T��ng 3: Nodes                 fetch-pr, analysis-agent, synthesizer, human-approval...
T��ng 4: Shared utilities      withStep, parseLLMJson, retry, notify, internal-api
T��ng 5: External boundaries   github.tools, gemini, config
```

## 8 nguyên tắc thiết kế rút ra từ codebase này

1. **Lazy evaluation** (config.ts) — chỉ làm việc khi thật cần
2. **DRY qua abstraction** (withStep) — tách cái chung khỏi cái riêng
3. **Base + spec** (analysis-agent) — nhiều thứ giống nhau dùng chung base
4. **Phân loại lỗi 2 tầng** (TerminalError vs Error) — retry được hay không
5. **Graceful degradation** (fallbackReport) — một phần lỗi không giết toàn bộ
6. **Phân biệt mức nghiêm trọng** (notify vs internal-api) — best-effort vs must-surface
7. **Defensive với LLM** (normalize, parseLLMJson) — không tin output của LLM
8. **Chọn đúng công cụ** (digest không dùng LangGraph) — đừng over-engineer

## 3 khái niệm Restate quan trọng nhất

- **Workflow + ctx.run + journal** — chạy một lần, mỗi bước được ghi lại, crash thì resume
- **Awakeable** — lời hứa bền vững, suspend chờ sự kiện ngoài (human approval)
- **Virtual Object** — thực thể có state theo key, truy cập tuần tự tự động
- **Durable sleep** — timer sống ngoài process, thay thế cron job

## 3 khái niệm AI/LangGraph quan trọng nhất

- **Agent = LLM + tools** — LLM tự quyết định hành động, khác chatbot
- **StateGraph** — vẽ flow agent bằng node + edge, fan-out/fan-in
- **ReAct agent** — LLM tự quyết định gọi tool nào, không cần flow cố định

---

# Thứ tự đọc code đề xuất (nếu đọc lại)

1. config.ts → load-env.ts → index.ts (khởi động)
2. state.ts → review-graph.ts (cấu trúc)
3. lib/step.ts → lib/notify.ts → lib/internal-api.ts (hạ tầng)
4. github.tools.ts → gemini.ts (boundary)
5. fetch-pr.ts → orchestrator.ts (node đơn giản)
6. analysis-agent.ts → quality-agent.ts (agent + base)
7. synthesizer.ts (gộp + fallback)
8. human-approval.ts (Restate awakeable — đọc kỹ nhất)
9. review-workflow.ts (workflow + cancel)
10. project-assistant.ts (Virtual Object)
11. digest-agent.ts (durable sleep)
12. assistant-graph.ts → assistant-tools.ts (ReAct + tools)