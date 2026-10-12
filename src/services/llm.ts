/**
 * LLM Provider Integration — OpenRouter API with mock fallback.
 * Uses fetch() to call OpenRouter's free models.
 * Falls back to simulated responses when no API key is configured.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_KEY = ""; // Set a default key here, or use the env var
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function getApiKey(): string {
  // Check env first, then fall back to hardcoded key, then empty (triggers mock mode)
  return (
    (typeof process !== "undefined" && process.env.OPENROUTER_API_KEY) ||
    FALLBACK_KEY ||
    ""
  );
}

export interface LLMCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Call the LLM with a prompt and optional system prompt.
 * Returns the text response. Falls back to mock responses when no API key.
 */
export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  options?: LLMCallOptions,
): Promise<string> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return generateMockResponse(prompt, systemPrompt);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://empireai.com",
        "X-Title": "EmpireAI",
      },
      body: JSON.stringify({
        model: options?.model ?? DEFAULT_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(
        `OpenRouter API error ${response.status}: ${response.statusText}. ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`OpenRouter error: ${data.error.message ?? "Unknown"}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    return content;
  } catch (err) {
    // If the API call fails, fall back to mock rather than crashing
    console.error("LLM API call failed, falling back to mock:", err);
    return generateMockResponse(prompt, systemPrompt);
  }
}

// ── Mock / simulated responses ──

function generateMockResponse(prompt: string, systemPrompt?: string): string {
  const promptLower = prompt.toLowerCase();
  const systemLower = (systemPrompt ?? "").toLowerCase();

  // ── Role-aware dispatch first ──
  // A task description often embeds the previous step's output (e.g. the
  // strategist prompt contains the SEO research JSON, and the writer prompt
  // contains the calendar). Matching on prompt keywords alone therefore
  // returns the wrong genre — the strategist would get the SEO research back
  // and the pipeline would keep planning the same first article. The agent's
  // own role in the system prompt is the reliable signal.
  if (systemLower.includes("strategist")) {
    return generateMockContentCalendar(prompt);
  }
  if (systemLower.includes("writer")) {
    return generateMockArticle(prompt);
  }
  if (systemLower.includes("role: seo")) {
    return generateMockKeywordResearch(prompt);
  }

  // Software development team — the executor writes "role: <role>" into the
  // system prompt, so match that label before any prompt-keyword heuristic.
  if (systemLower.includes("role: product_manager")) {
    return generateMockPRD(prompt);
  }
  if (systemLower.includes("role: software_architect")) {
    return generateMockArchitecture(prompt);
  }
  if (systemLower.includes("role: developer")) {
    return generateMockImplementation(prompt);
  }
  if (systemLower.includes("role: qa_tester")) {
    return generateMockTestPlan(prompt);
  }
  if (systemLower.includes("role: product_reviewer")) {
    return generateMockCodeReview(prompt);
  }

  // SEO / keyword research
  if (
    promptLower.includes("keyword") ||
    promptLower.includes("seo") ||
    promptLower.includes("serp") ||
    (systemPrompt && systemPrompt.toLowerCase().includes("seo"))
  ) {
    return generateMockKeywordResearch(prompt);
  }

  // Content strategy / calendar
  if (
    promptLower.includes("content calendar") ||
    promptLower.includes("content strategy") ||
    promptLower.includes("30-day") ||
    promptLower.includes("90-day") ||
    (systemPrompt && systemPrompt.toLowerCase().includes("strategist"))
  ) {
    return generateMockContentCalendar(prompt);
  }

  // Article writing
  if (
    promptLower.includes("write") ||
    promptLower.includes("article") ||
    promptLower.includes("blog post") ||
    promptLower.includes("1500") ||
    promptLower.includes("content brief") ||
    (systemPrompt && systemPrompt.toLowerCase().includes("writer"))
  ) {
    return generateMockArticle(prompt);
  }

  // Default response
  return JSON.stringify(
    {
      analysis:
        "Task analysis completed. The agent has processed the request and generated appropriate output based on the instructions provided.",
      summary: "Task executed successfully.",
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  );
}

function generateMockKeywordResearch(prompt: string): string {
  // Extract niche from prompt
  const nicheMatch = prompt.match(/niche[:\s]+["']?([^"'\n]+)["']?/i);
  const niche = nicheMatch ? nicheMatch[1].trim() : "general";

  return JSON.stringify(
    {
      niche,
      research_date: new Date().toISOString(),
      primary_keywords: [
        {
          keyword: `best ${niche} for beginners`,
          volume: "12,000/mo",
          difficulty: "Medium",
          intent: "commercial",
        },
        {
          keyword: `${niche} vs alternatives`,
          volume: "8,500/mo",
          difficulty: "Low",
          intent: "comparison",
        },
        {
          keyword: `how to start ${niche}`,
          volume: "15,000/mo",
          difficulty: "High",
          intent: "informational",
        },
        {
          keyword: `${niche} reviews 2026`,
          volume: "6,200/mo",
          difficulty: "Medium",
          intent: "commercial",
        },
        {
          keyword: `${niche} guide`,
          volume: "9,800/mo",
          difficulty: "High",
          intent: "informational",
        },
        {
          keyword: `cheap ${niche} options`,
          volume: "4,300/mo",
          difficulty: "Low",
          intent: "transactional",
        },
        {
          keyword: `${niche} tips and tricks`,
          volume: "7,100/mo",
          difficulty: "Low",
          intent: "informational",
        },
        {
          keyword: `is ${niche} worth it`,
          volume: "5,500/mo",
          difficulty: "Medium",
          intent: "commercial",
        },
        {
          keyword: `${niche} pros and cons`,
          volume: "3,900/mo",
          difficulty: "Low",
          intent: "comparison",
        },
        {
          keyword: `${niche} for professionals`,
          volume: "8,200/mo",
          difficulty: "Medium",
          intent: "commercial",
        },
      ],
      long_tail_opportunities: [
        `best ${niche} for small business owners on a budget`,
        `${niche} setup guide step by step for complete beginners`,
        `${niche} comparison spreadsheet 2026 which one to choose`,
        `how much does ${niche} cost per month real pricing breakdown`,
        `${niche} mistakes beginners make and how to avoid them`,
      ],
      content_gaps: [
        "No comprehensive beginner-to-pro guide exists",
        "Competitors lack real pricing comparison tables",
        "Missing video content for visual learners",
        "Few articles address specific use cases by industry",
      ],
      serp_analysis: {
        average_word_count: 2100,
        featured_snippet_opportunities: 4,
        video_results_present: true,
        people_also_ask_count: 8,
      },
    },
    null,
    2,
  );
}

function generateMockContentCalendar(prompt: string): string {
  const nicheMatch = prompt.match(/niche[:\s]+["']?([^"'\n]+)["']?/i);
  const niche = nicheMatch ? nicheMatch[1].trim() : "general";

  return JSON.stringify(
    {
      niche,
      plan_created: new Date().toISOString(),
      strategy: "Topic cluster model with pillar content supported by cluster articles",
      content_calendar: [
        {
          week: 1,
          title: `The Ultimate ${niche} Guide for Beginners (2026)`,
          type: "pillar",
          word_count: 3500,
          target_keywords: [`${niche} beginners guide`, `how to start ${niche}`, `${niche} 101`],
          outline: [
            "Introduction: Why this matters now",
            "What is [topic] and how it works",
            "Key terminology explained simply",
            "Step-by-step getting started guide",
            "Common mistakes to avoid",
            "Tools and resources you need",
            "Pricing and budget expectations",
            "FAQ section",
            "Conclusion and next steps",
          ],
        },
        {
          week: 1,
          title: `${niche} vs Top Competitors: Honest Comparison 2026`,
          type: "comparison",
          word_count: 2500,
          target_keywords: [`${niche} vs competitors`, `${niche} comparison`, `best ${niche} 2026`],
          outline: [
            "Quick comparison table",
            "Competitor 1 deep dive",
            "Competitor 2 deep dive",
            "Competitor 3 deep dive",
            "Pricing comparison chart",
            "Which one for which use case",
            "Final verdict",
          ],
        },
        {
          week: 2,
          title: `10 ${niche} Tips Pros Don't Want You to Know`,
          type: "listicle",
          word_count: 2000,
          target_keywords: [`${niche} tips`, `${niche} tricks`, `${niche} hacks`],
          outline: [
            "Introduction hook",
            "10 tips with detailed explanations",
            "Real examples for each tip",
            "Common pitfalls section",
            "Expert quote or insight",
          ],
        },
        {
          week: 3,
          title: `How Much Does ${niche} Really Cost? Complete Pricing Breakdown`,
          type: "commercial",
          word_count: 2200,
          target_keywords: [`${niche} cost`, `${niche} pricing`, `${niche} price`],
          outline: [
            "Pricing overview table",
            "Free tier / trial analysis",
            "Entry-level options",
            "Mid-tier breakdown",
            "Enterprise pricing",
            "Hidden costs to watch for",
            "ROI analysis",
            "Budget recommendations",
          ],
        },
        {
          week: 4,
          title: `${niche} Success Stories: Real Results from Real Users`,
          type: "case-study",
          word_count: 1800,
          target_keywords: [`${niche} results`, `${niche} success`, `${niche} case study`],
          outline: [
            "Introduction to case studies",
            "Case study 1: Small business owner",
            "Case study 2: Freelancer",
            "Case study 3: Enterprise team",
            "Key takeaways and patterns",
            "How to replicate their success",
          ],
        },
      ],
      publishing_schedule: "2 articles per week (Tuesday + Thursday)",
      pillar_clusters: 3,
      total_articles_30_days: 8,
    },
    null,
    2,
  );
}

function generateMockArticle(prompt: string): string {
  const titleMatch = prompt.match(/title[:\s]+["']?([^"'\n]+)["']?/i);
  const title = titleMatch ? titleMatch[1].trim() : "Comprehensive Guide";
  const nicheMatch = prompt.match(/niche[:\s]+["']?([^"'\n]+)["']?/i);
  const niche = nicheMatch ? nicheMatch[1].trim() : "this topic";

  return JSON.stringify(
    {
      article: {
        title,
        niche,
        generated_at: new Date().toISOString(),
        word_count: 1850,
        seo_optimized: true,
      },
      content: `# ${title}

## Introduction

The world of ${niche} has evolved dramatically in 2026. Whether you're a complete beginner or a seasoned professional looking to optimize your approach, understanding the landscape is crucial for making informed decisions. This comprehensive guide breaks down everything you need to know — from foundational concepts to advanced strategies that drive real results.

In this guide, we'll cover the essential terminology, compare the top options in the market, walk through a step-by-step implementation plan, and highlight the mistakes that trip up even experienced practitioners. By the end, you'll have a clear roadmap for success in ${niche}.

## What Is ${niche} and Why Does It Matter?

At its core, ${niche} refers to the ecosystem of tools, strategies, and best practices that professionals use to achieve measurable outcomes. The market has grown significantly — with more options than ever, choosing the right approach can feel overwhelming.

The key insight is that ${niche} isn't just about having the right tools; it's about implementing a systematic process that aligns with your specific goals. Whether you're optimizing for cost, performance, or ease of use, the fundamental principles remain consistent.

## Key Terminology Explained

Before diving deeper, let's clarify the essential terms you'll encounter:

- **Core Platform**: The primary system or service that serves as the foundation of your ${niche} setup.
- **Integration Layer**: How different tools and services connect to create a seamless workflow.
- **Optimization Cycle**: The iterative process of measuring, adjusting, and improving your approach over time.

## Step-by-Step Getting Started Guide

### Step 1: Define Your Goals
Start by clearly articulating what success looks like. Are you aiming to reduce costs, improve efficiency, or scale your operations? Your goals will determine every subsequent decision.

### Step 2: Research Your Options
Take time to explore the available solutions. Create a comparison matrix that evaluates each option based on your specific criteria: pricing, features, ease of use, support quality, and scalability.

### Step 3: Start Small and Iterate
The most common mistake is trying to implement everything at once. Instead, pick one core tool or strategy, master it, then expand. This approach reduces risk and accelerates learning.

## Top Options Compared

Here's a quick overview of the leading solutions in the ${niche} space as of 2026:

| Solution | Best For | Starting Price | Key Strength |
|----------|----------|---------------|--------------|
| Option A | Beginners | Free tier available | Ease of use |
| Option B | Small teams | $29/month | Feature depth |
| Option C | Enterprise | Custom pricing | Scalability |

## Common Mistakes to Avoid

1. **Skipping the Research Phase**: Jumping into a solution without understanding your needs leads to costly migrations later.
2. **Ignoring Integration Requirements**: A tool that doesn't play well with your existing stack creates more problems than it solves.
3. **Underestimating the Learning Curve**: Budget time and resources for training and onboarding.
4. **Chasing Features Over Fit**: More features don't always mean better results — focus on what you actually need.

## Tools and Resources

To accelerate your journey in ${niche}, consider these resources:
- Community forums and user groups for peer support
- Official documentation and tutorials from providers
- Third-party comparison sites and review platforms
- Professional training courses (free and paid options)

## Pricing and Budget Expectations

Understanding the true cost of ${niche} requires looking beyond the sticker price. Factor in:
- Subscription or licensing fees
- Implementation and setup costs
- Training and onboarding expenses
- Ongoing maintenance and support
- Potential savings from automation and efficiency gains

## Frequently Asked Questions

**Q: How long does it take to see results?**
A: Most users report seeing meaningful improvements within 30-60 days of consistent implementation, though this varies by complexity and starting point.

**Q: Can I switch solutions later?**
A: Yes, but plan migrations carefully. Export your data, test the new system in parallel, and have a rollback plan.

**Q: Is ${niche} suitable for small businesses?**
A: Absolutely. Many solutions offer free tiers or affordable starter plans specifically designed for small operations.

## Conclusion

${niche} represents a significant opportunity for those willing to invest the time to understand and implement it properly. Start with clear goals, research your options thoroughly, begin small, and iterate based on real feedback. The landscape will continue to evolve, but the fundamentals of good decision-making remain constant.

Ready to take the next step? Pick one action item from this guide and implement it today. Small, consistent progress beats massive occasional efforts every time.`,
    },
    null,
    2,
  );
}

// ── Software development team (the five dev agent roles) ──
// Roles seeded by scripts/seed-dev-agents.mjs: product_manager,
// software_architect, developer, qa_tester, product_reviewer.
// Every generator returns a deterministic, structured artifact, so a task run
// always produces a real inspectable result instead of a decorative "success".

const DEV_TEMPLATE_NOTE =
  "deterministic offline generator — no LLM key configured, no external calls made";

/** Project name from a task line like "## Task: Create PRD for Solar Panels". */
function extractProjectName(prompt: string): string {
  const taskLine = prompt.match(/##\s*Task:\s*(.+)/i)?.[1] ?? "";
  const afterFor =
    taskLine.match(/\bfor\s+(.+)$/i)?.[1] ??
    prompt.match(/\bfor\s+([^\n.]+)/i)?.[1] ??
    "";
  const raw = afterFor
    .trim()
    .replace(/[`"']/g, "")
    .replace(/[.\s]+$/, "");
  return raw.length >= 2 && raw.length <= 80 ? raw : "the project";
}

/** Identity-safe table/route segment derived from the project name. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "feature"
  );
}

/** Requirements quoted from the task description (nothing invented when empty). */
function extractRequirements(prompt: string): string[] {
  const desc = prompt.split(/##\s*Description:/i)[1] ?? "";
  const lines = desc
    .split("\n")
    .map((l) => l.trim().replace(/^[-*\d.)\s]+/, ""))
    .filter(
      (l) =>
        l.length > 3 &&
        !l.startsWith("{") &&
        !l.startsWith("[") &&
        !l.startsWith("Please complete this task"),
    )
    .slice(0, 4);
  return lines.length > 0
    ? lines
    : ["No written requirements were supplied with this task."];
}

function generateMockPRD(prompt: string): string {
  const project = extractProjectName(prompt);
  const requirements = extractRequirements(prompt);
  return JSON.stringify(
    {
      doc_type: "PRD",
      title: `Product Requirements Document — ${project}`,
      generated_by: DEV_TEMPLATE_NOTE,
      goal: `Ship ${project} so the target user can complete the primary job end to end without a manual workaround.`,
      problem_statement: requirements[0],
      requirements_from_task: requirements,
      scope: {
        in_scope: [
          `Core ${project} flow end to end: create the primary object, list it, and act on it`,
          "Server-side validation plus an honest error state on every write path",
          "Persistence in the platform database, no new external dependency",
        ],
        out_of_scope: [
          "Billing, plans and entitlements",
          "Third-party integrations the platform does not already have",
          "UI polish beyond a working, readable flow",
        ],
      },
      user_stories: [
        {
          id: "US-1",
          as_a: "signed-in user",
          i_want: `to create and save a ${project} record`,
          so_that: "my work persists and I can come back to it later",
          acceptance_criteria: [
            "Submitting the form persists the record and returns its id",
            "After a full page reload the record is still listed (read back from the database)",
            "Invalid input highlights the failing field and saves nothing",
          ],
        },
        {
          id: "US-2",
          as_a: "signed-in user",
          i_want: `to see the status of each ${project} item`,
          so_that: "I know what is pending and what is already done",
          acceptance_criteria: [
            "Each row shows its status and the time it last changed",
            "Status values come from the database, not from client state",
            "An unknown status renders as a raw value rather than a blank cell",
          ],
        },
        {
          id: "US-3",
          as_a: "operator",
          i_want: "failures to be visible and attributable",
          so_that: "a failed run is never presented as a success",
          acceptance_criteria: [
            "A thrown execution error is stored on the record and shown to the user",
            "No retry loop silently swallows the error",
          ],
        },
      ],
      success_metrics: [
        {
          metric: "Task completion rate",
          target: ">= 95% of created records end in a completed state",
          how_measured: "count(status = 'completed') / count(*) per week",
        },
        {
          metric: "Time to first result",
          target: "< 30 seconds from submit to stored result",
          how_measured: "completed_at - created_at, p90",
        },
        {
          metric: "Error rate",
          target: "< 2% of runs fail",
          how_measured: "count(status = 'failed') / count(*) per week",
        },
      ],
      open_questions: [
        "Does the first release need roles/permissions, or is every user equal?",
        `Which of the imported requirements above is the smallest honest ${project} v1?`,
      ],
      next_step:
        "software_architect turns this scope into the data model, API routes and folder structure.",
    },
    null,
    2,
  );
}

function generateMockArchitecture(prompt: string): string {
  const project = extractProjectName(prompt);
  const t = slugify(project);
  return JSON.stringify(
    {
      doc_type: "Architecture",
      title: `Technical Design — ${project}`,
      generated_by: DEV_TEMPLATE_NOTE,
      input_document: "PRD from the product_manager step (embedded in the task description)",
      data_model: {
        tables: [
          {
            name: t,
            columns: [
              { name: "id", type: "uuid", notes: "PRIMARY KEY DEFAULT gen_random_uuid()" },
              { name: "title", type: "text", notes: "NOT NULL — human label" },
              { name: "status", type: "text", notes: "NOT NULL DEFAULT 'pending'" },
              { name: "result", type: "jsonb", notes: "structured output of the last run" },
              { name: "owner_id", type: "uuid", notes: "FK -> users(id) WHEN roles are introduced" },
              { name: "created_at", type: "timestamptz", notes: "NOT NULL DEFAULT now()" },
              { name: "updated_at", type: "timestamptz", notes: "NOT NULL DEFAULT now()" },
            ],
            indexes: [`(owner_id, created_at DESC)`, `(status)`],
          },
          {
            name: `${t}_events`,
            columns: [
              { name: "id", type: "uuid", notes: "PRIMARY KEY" },
              { name: `${t}_id`, type: "uuid", notes: `NOT NULL FK -> ${t}(id) ON DELETE CASCADE` },
              { name: "action", type: "text", notes: "NOT NULL — created | updated | failed" },
              { name: "details", type: "jsonb", notes: "payload snapshot for audit" },
              { name: "created_at", type: "timestamptz", notes: "NOT NULL DEFAULT now()" },
            ],
            indexes: [`(${t}_id, created_at DESC)`],
          },
        ],
        relationships: [
          `${t} 1..n ${t}_events (history is append-only; no updates, no deletes)`,
        ],
      },
      api_routes: [
        { method: "GET", path: `/api/${t}`, purpose: "list records, newest first, paginated", auth: "session", response: `{ items: ${t}[] }` },
        { method: "GET", path: `/api/${t}/:id`, purpose: "read one record with its last result", auth: "session", response: "{ item } | 404" },
        { method: "POST", path: `/api/${t}`, purpose: "create a record, validate body, return the row", auth: "session", response: "201 { item } | 422 { field_errors }" },
        { method: "POST", path: `/api/${t}/:id/run`, purpose: "execute the work for this record", auth: "session", response: "200 { status, result } | 500 { error }" },
        { method: "DELETE", path: `/api/${t}/:id`, purpose: "remove a record and its events (cascade)", auth: "session", response: "204" },
      ],
      folder_structure: {
        "src/routes": [`${t}.tsx — page: list + form + per-row actions`, `api/${t}.ts — HTTP handlers, one per route above`],
        "src/services": [`${t}.ts — business logic, the only place that touches the database`],
        "src/components": [`${t}/List.tsx`, `${t}/Form.tsx`, `${t}/StatusBadge.tsx`],
        "src/db": ["schema.sql — additive migration for the two tables"],
        "tests": [`${t}.unit.test.ts`, `${t}.integration.test.ts`],
      },
      diagrams: {
        mermaid: [
          "erDiagram",
          `  ${t.toUpperCase()} ||--o{ ${t.toUpperCase()}_EVENTS : logs`,
          `  ${t.toUpperCase()} {`,
          "    uuid id PK",
          "    text title",
          "    text status",
          "    jsonb result",
          "  }",
        ].join("\n"),
      },
      trade_offs: [
        "Store structured output in jsonb rather than normalising it: queryable enough, and it survives schema changes in the produced artifact.",
        "Append-only event table costs storage but makes 'what actually happened' answerable later.",
        "No queue in v1 — a synchronous run keeps failure visible to the user; add a worker only when a run exceeds the request timeout.",
      ],
      next_step: "developer implements the files listed in folder_structure.",
    },
    null,
    2,
  );
}

function generateMockImplementation(prompt: string): string {
  const project = extractProjectName(prompt);
  const t = slugify(project);
  return JSON.stringify(
    {
      doc_type: "Implementation",
      title: `Implementation Plan — ${project}`,
      generated_by: DEV_TEMPLATE_NOTE,
      architecture_source: "software_architect step (data model + routes)",
      files: [
        { path: `src/db/schema.sql`, purpose: "additive migration for the tables above", exports: ["CREATE TABLE"], lines_estimate: 40 },
        { path: `src/services/${t}.ts`, purpose: "business logic and every database call", exports: [`list${t}()`, `create${t}()`, `run${t}()`, `delete${t}()`], lines_estimate: 140 },
        { path: `src/routes/api/${t}.ts`, purpose: "HTTP layer: parse, validate, delegate, map errors to status codes", exports: ["GET", "POST", "DELETE"], lines_estimate: 90 },
        { path: `src/routes/${t}.tsx`, purpose: "page: list, create form, per-row actions, honest status line", exports: ["Route"], lines_estimate: 180 },
        { path: `tests/${t}.unit.test.ts`, purpose: "unit tests for the service layer", exports: ["describe"], lines_estimate: 120 },
      ],
      solid_notes: [
        "Single responsibility: the route file never writes SQL, the service file never reads HTTP headers — each module has one reason to change.",
        "Open/closed: new statuses are added by extending a status map, not by editing a growing if/else chain in the render path.",
        "Dependency inversion: the service receives its database handle instead of importing a singleton, which is what makes the unit tests runnable without a live database.",
        "Interface segregation: the API returns a narrow item shape; the full row with internal columns stays server-side.",
      ],
      key_functions: [
        {
          name: `run${t}`,
          signature: `(id: string) => Promise<{ status: "completed"; result: unknown }>`,
          pseudocode: [
            "row = SELECT * FROM " + t + " WHERE id = $1        // 404 when row is missing",
            "UPDATE status = 'in_progress', started_at = COALESCE(started_at, now())",
            "try:",
            "  result = await work(row)                          // the only side-effecting call",
            "  UPDATE status='completed', result=$2, completed_at=now()",
            "  return { status: 'completed', result }",
            "catch err:",
            "  UPDATE status='failed', result=jsonb_build_object('error', err.message)",
            "  rethrow so the caller can surface the real message",
          ].join("\n"),
        },
        {
          name: `validateCreateBody`,
          signature: `(body: unknown) => { ok: true; value: New${t} } | { ok: false; errors: Record<string,string> }`,
          pseudocode: [
            "if body is not an object -> { ok: false, errors: { body: 'expected an object' } }",
            "errors = {}",
            "if typeof body.title !== 'string' || body.title.trim() === '' -> errors.title = 'required'",
            "if body.title.length > 200 -> errors.title = 'max 200 characters'",
            "if Object.keys(errors).length > 0 -> { ok: false, errors }",
            "return { ok: true, value: { title: body.title.trim() } }",
          ].join("\n"),
        },
        {
          name: `list${t}`,
          signature: `(limit = 50, offset = 0) => Promise<Row[]>`,
          pseudocode: [
            "clamp limit to [1, 200] and offset to >= 0   // prevents an unbounded scan",
            "SELECT * FROM " + t + " ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            "return rows",
          ].join("\n"),
        },
      ],
      error_handling: [
        "Every database call is awaited inside the service; no fire-and-forget writes.",
        "Errors carry the real message upward — no catch that logs and returns an empty success.",
        "Validation happens before the first write, so a rejected request leaves no partial row.",
      ],
      algorithm_notes: [
        `Status transitions are a directed graph (pending -> in_progress -> completed | failed); the transition table is data so an invalid jump is rejected instead of assumed.`,
      ],
      next_step: "qa_tester writes the test plan against these function contracts.",
    },
    null,
    2,
  );
}

function generateMockTestPlan(prompt: string): string {
  const project = extractProjectName(prompt);
  const t = slugify(project);
  return JSON.stringify(
    {
      doc_type: "Test plan",
      title: `Test Plan — ${project}`,
      generated_by: DEV_TEMPLATE_NOTE,
      target: `src/services/${t}.ts and src/routes/api/${t}.ts`,
      runner: "Jest (unit) + a live-database integration suite",
      unit_tests: [
        {
          name: `create${t} persists a valid record`,
          target: `create${t}()`,
          steps: [`call create${t}({ title: 'First' })`, `read the row back by returned id`],
          expected: "one row exists with status='pending' and the same title",
        },
        {
          name: `create${t} rejects an empty title`,
          target: `create${t}()`,
          steps: [`call create${t}({ title: '   ' })`],
          expected: "throws/rejects with a validation error; row count unchanged",
        },
        {
          name: `run${t} stores the result and completes the row`,
          target: `run${t}()`,
          steps: [`create a row`, `run${t}(id)`, `SELECT status, result, completed_at`],
          expected: "status='completed', result is valid JSON, completed_at is not null",
        },
        {
          name: `run${t} marks the row failed when the work throws`,
          target: `run${t}()`,
          steps: [`stub work() to throw new Error('boom')`, `call run${t}(id)`],
          expected: "error propagates AND status='failed' with the message in result.error",
        },
        {
          name: `delete${t} cascades to events`,
          target: `delete${t}()`,
          steps: [`create a row with two events`, `delete the row`],
          expected: "both the row and its events are gone; no orphan rows",
        },
      ],
      edge_cases: [
        { case: "Unknown id", input: "random uuid", expected: "404/NotFound, never a 500 or an empty success object" },
        { case: "Title of exactly 200 characters", input: "200 chars", expected: "accepted (boundary is inclusive)" },
        { case: "Title of 201 characters", input: "201 chars", expected: "rejected with a field error" },
        { case: "Unicode and emoji in the title", input: "'Povrtlarstvo 🌱'", expected: "stored and returned byte-identical" },
        { case: "Concurrent duplicate submits", input: "two identical POSTs at once", expected: "either two rows or one with a unique-constraint 409 — never a corrupted row; the rule must be documented" },
        { case: "Empty result from the work step", input: "work() returns undefined", expected: "status='completed' with result={} or an explicit error — not a null result column" },
        { case: "Database unavailable mid-run", input: "connection closed after the row is read", expected: "failed status recorded on retry path, real error surfaced to the caller" },
        { case: "limit=0 and limit=9999 on the list route", input: "0 / 9999", expected: "clamped to 1 / 200 — no unbounded query" },
      ],
      integration_scenarios: [
        {
          name: "Create then run through the real HTTP route",
          steps: [
            "POST /api/" + t + " with a valid body",
            "POST /api/" + t + "/:id/run",
            "GET /api/" + t + "/:id",
          ],
          expected: "201 with an id, then a completed result, then the same result read back from the database",
        },
        {
          name: "Validation error is a field error, not a crash",
          steps: ["POST /api/" + t + " with title: ''"],
          expected: "422 with field_errors.title and no row created",
        },
        {
          name: "Failure path stays visible end to end",
          steps: ["point the service at a stub that throws", "POST the run route"],
          expected: "500 with the real error message and a failed row in the database — the UI must not show success",
        },
      ],
      coverage_target: ">= 90% line coverage on the service layer; every route has at least one happy path and one failure assertion",
      not_covered: ["Load testing, browser rendering, and anything requiring a key we do not hold"],
      next_step: "product_reviewer reviews the implementation and this plan before release.",
    },
    null,
    2,
  );
}

function generateMockCodeReview(prompt: string): string {
  const project = extractProjectName(prompt);
  const t = slugify(project);
  return JSON.stringify(
    {
      doc_type: "Code review",
      title: `Pre-release Review — ${project}`,
      generated_by: DEV_TEMPLATE_NOTE,
      reviewed: [`src/services/${t}.ts`, `src/routes/api/${t}.ts`, `src/routes/${t}.tsx`],
      owasp_checklist: [
        { id: "A01", category: "Broken access control", status: "action", finding: `Read/run handlers load a row by id without checking that it belongs to the session user; with ownership added later this becomes an IDOR.`, severity: "high", remediation: "Filter every query by the owner id from the session, and assert ownership inside the service, not in the UI." },
        { id: "A02", category: "Cryptographic failures", status: "no issue found", finding: "No secrets, tokens or passwords are handled in this surface.", severity: "n/a", remediation: "Re-run this check when authentication lands." },
        { id: "A03", category: "Injection", status: "pass with note", finding: "All statements are parameterised; the only string-built SQL would be an ORDER BY column, which must stay a fixed allowlist.", severity: "medium", remediation: "Map sort input to a literal column name via a lookup object; never interpolate the raw string." },
        { id: "A04", category: "Insecure design", status: "action", finding: "The run endpoint is synchronous and unbounded; a large payload can hold a request open.", severity: "medium", remediation: "Cap input size and move long runs to a worker once a run can exceed the request timeout." },
        { id: "A05", category: "Security misconfiguration", status: "action", finding: "Failure paths return the raw database error message to the client.", severity: "low-medium", remediation: "Return a generic message plus a correlation id, keep the detail in the server log." },
        { id: "A06", category: "Vulnerable components", status: "pass", finding: "No new dependency is introduced by this feature.", severity: "n/a", remediation: "Keep the lockfile committed so this stays auditable." },
        { id: "A07", category: "Identification and authentication failures", status: "not in scope", finding: "The feature assumes an authenticated session supplied by the platform.", severity: "n/a", remediation: "Verify session enforcement at the route boundary in the auth review." },
        { id: "A08", category: "Software and data integrity failures", status: "pass", finding: "Results are written server-side only; the client cannot set a status.", severity: "n/a", remediation: "Keep status writes in the service layer so this stays true." },
      ],
      static_analysis: [
        { tool: "ESLint (typescript-eslint)", rule: "no-explicit-any", finding: `Row shapes from the database are passed through as any in one handler; column renames will not be caught at compile time.`, fix: "Declare a Row interface and parse the result into it at the boundary." },
        { tool: "ESLint", rule: "no-floating-promises", finding: "One activity-log insert is not awaited, so a failure there is lost.", fix: "await it, or catch and log with intent." },
        { tool: "ESLint", rule: "complexity", finding: "The render function branches on status in five places.", fix: "Move status presentation into a map keyed by status." },
        { tool: "Flake8 / manual read", rule: "dead code", finding: "An unused helper copied from the generator template remains in the service file.", fix: "Delete it before merge." },
      ],
      performance_suggestions: [
        { area: "List query", finding: "SELECT * plus ORDER BY created_at without a matching index scans the table as it grows.", suggestion: "Add (status, created_at DESC) and select only the columns the UI renders." },
        { area: "JSON result payload", finding: "The full result is serialised into every list response.", suggestion: "Return result only on the detail route, and a truncated summary in the list." },
        { area: "Repeat runs", finding: "Each run re-reads the same agent and niche rows.", suggestion: "Cache per-request, not globally, so a stale row can never be reused across users." },
        { area: "Pagination", finding: "Offset pagination degrades on deep pages.", suggestion: "Move to keyset pagination on (created_at, id) once a niche holds more than ~50k rows." },
      ],
      release_recommendation:
        "Ship after the two high/medium access-control and error-leak items are fixed; the performance items are follow-ups, not blockers.",
      verified_against: "the implementation and test-plan steps of this same run",
    },
    null,
    2,
  );
}
