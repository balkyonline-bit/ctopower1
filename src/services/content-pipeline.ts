/**
 * Content Pipeline — chains 3 AI agent tasks together:
 * 1. SEO Research Agent → keyword list + content ideas
 * 2. Content Strategist → 5-article content calendar
 * 3. AI Writer Agent → first article (1500+ words, SEO optimized)
 *
 * Each step feeds its results into the next step's task description.
 */
import { getSql } from "~/db";
import { executeTask } from "~/services/agent-executor";

export interface PipelineResult {
  success: boolean;
  nicheSlug: string;
  nicheName: string;
  steps: Array<{
    step: number;
    agent: string;
    taskId: string;
    success: boolean;
    summary: string;
    error?: string;
  }>;
  article?: {
    id: string;
    slug: string;
    title: string;
  };
  error?: string;
}

/**
 * Run the full content pipeline for a given niche slug.
 */
export async function runContentPipeline(
  nicheSlug: string,
): Promise<PipelineResult> {
  const sql = getSql();

  // 1. Find the niche profile
  const nicheRows = await sql`
    SELECT id, niche_name, slug FROM niche_profiles WHERE slug = ${nicheSlug} LIMIT 1
  `;

  if (nicheRows.length === 0) {
    throw new Error(`Niche not found: ${nicheSlug}`);
  }

  const niche = nicheRows[0] as { id: string; niche_name: string; slug: string };

  // 2. Find the required agents
  const seoAgent = await sql`
    SELECT id, name FROM ai_agents WHERE role = 'seo' LIMIT 1
  `;
  const strategistAgent = await sql`
    SELECT id, name FROM ai_agents WHERE role = 'strategist' LIMIT 1
  `;
  const writerAgent = await sql`
    SELECT id, name FROM ai_agents WHERE role = 'writer' LIMIT 1
  `;

  if (seoAgent.length === 0 || strategistAgent.length === 0 || writerAgent.length === 0) {
    throw new Error("Required agents not found. Ensure SEO, Strategist, and Writer agents are seeded.");
  }

  const seoId = (seoAgent[0] as { id: string }).id;
  const stratId = (strategistAgent[0] as { id: string }).id;
  const writerId = (writerAgent[0] as { id: string }).id;

  const steps: PipelineResult["steps"] = [];

  // ── Step 1: SEO Research ──
  const seoTitle = `SEO Research: ${niche.niche_name}`;
  const seoDescription = `
Conduct comprehensive SEO keyword research for the niche: "${niche.niche_name}".

Find:
- 10 primary keywords with search volume, difficulty, and intent
- 5 long-tail keyword opportunities
- Content gaps in the current SERP landscape
- Featured snippet opportunities
- People Also Ask topics

Output the results as structured JSON with keywords, volumes, and content recommendations.
  `.trim();

  await sql`
    INSERT INTO agent_tasks (agent_id, niche_id, title, description, status)
    VALUES (${seoId}, ${niche.id}, ${seoTitle}, ${seoDescription}, 'pending')
  `;

  // Get the newly created task ID
  const seoTaskRows = await sql`
    SELECT id FROM agent_tasks
    WHERE agent_id = ${seoId} AND niche_id = ${niche.id} AND title = ${seoTitle}
    ORDER BY created_at DESC LIMIT 1
  `;
  const seoTaskId = (seoTaskRows[0] as { id: string }).id;

  let seoResult: ExecuteTaskResultForPipeline;
  try {
    const { executeTask } = await import("~/services/agent-executor");
    seoResult = await executeTask(seoTaskId);
    steps.push({
      step: 1,
      agent: "SEO Research Agent",
      taskId: seoTaskId,
      success: seoResult.success,
      summary: seoResult.success
        ? `Generated keyword research for "${niche.niche_name}"`
        : `SEO research failed`,
      error: seoResult.error,
    });
  } catch (err) {
    steps.push({
      step: 1,
      agent: "SEO Research Agent",
      taskId: seoTaskId,
      success: false,
      summary: "SEO research failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, nicheSlug, nicheName: niche.niche_name, steps, error: "SEO step failed" };
  }

  // ── Step 2: Content Strategy ──
  // Feed SEO results into the strategist task
  const seoSummary = typeof seoResult.result === "object" && seoResult.result !== null
    ? JSON.stringify(seoResult.result).substring(0, 2000)
    : "Keyword research completed. Use findings to plan content.";

  const stratTitle = `Content Strategy: ${niche.niche_name}`;
  const stratDescription = `
Build a 5-article content calendar for the niche: "${niche.niche_name}".

## SEO Research Results (from previous step):
${seoSummary}

## Instructions:
Using the keyword research above, create a 5-article content calendar that includes:
- Article titles optimized for the target keywords
- Content type (pillar, comparison, listicle, commercial, case-study)
- Target word count for each article
- Primary and secondary keywords per article
- A detailed outline for each article
- Recommended publishing schedule

Output as structured JSON.
  `.trim();

  await sql`
    INSERT INTO agent_tasks (agent_id, niche_id, title, description, status)
    VALUES (${stratId}, ${niche.id}, ${stratTitle}, ${stratDescription}, 'pending')
  `;

  const stratTaskRows = await sql`
    SELECT id FROM agent_tasks
    WHERE agent_id = ${stratId} AND niche_id = ${niche.id} AND title = ${stratTitle}
    ORDER BY created_at DESC LIMIT 1
  `;
  const stratTaskId = (stratTaskRows[0] as { id: string }).id;

  let stratResult: ExecuteTaskResultForPipeline;
  try {
    const { executeTask } = await import("~/services/agent-executor");
    stratResult = await executeTask(stratTaskId);
    steps.push({
      step: 2,
      agent: "Content Strategist",
      taskId: stratTaskId,
      success: stratResult.success,
      summary: stratResult.success
        ? `Created 5-article content calendar for "${niche.niche_name}"`
        : "Content strategy failed",
      error: stratResult.error,
    });
  } catch (err) {
    steps.push({
      step: 2,
      agent: "Content Strategist",
      taskId: stratTaskId,
      success: false,
      summary: "Content strategy failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, nicheSlug, nicheName: niche.niche_name, steps, error: "Strategy step failed" };
  }

  // ── Step 3: AI Writer ──
  // Extract the first article title from the strategy results
  let firstArticleTitle = `${niche.niche_name}: Complete Guide`;
  let articleBrief = "Write a comprehensive, SEO-optimized guide.";

  if (stratResult.success && typeof stratResult.result === "object" && stratResult.result !== null) {
    const stratData = stratResult.result as Record<string, unknown>;
    const calendar = stratData.content_calendar as Array<Record<string, unknown>> | undefined;
    if (calendar && calendar.length > 0 && calendar[0].title) {
      firstArticleTitle = String(calendar[0].title);
      const outline = calendar[0].outline as string[] | undefined;
      if (outline) {
        articleBrief = `Write using this outline:\n${outline.map((o) => `- ${o}`).join("\n")}`;
      }
    }
  }

  const writerTitle = `Write Article: ${firstArticleTitle}`;
  const writerDescription = `
Write a comprehensive, SEO-optimized article for the niche: "${niche.niche_name}".

## Article Title:
${firstArticleTitle}

## Requirements:
- 1500+ words minimum
- SEO optimized with natural keyword integration
- Include introduction, body sections, and conclusion
- Use proper heading hierarchy (H2, H3)
- Include practical examples and actionable advice
- Professional yet accessible tone

${articleBrief}

## Strategy Context:
${typeof stratResult.result === "object" && stratResult.result !== null ? JSON.stringify(stratResult.result).substring(0, 1500) : "Content strategy completed. Write the first article based on the calendar."}

Output as structured JSON with the full article content and metadata.
  `.trim();

  await sql`
    INSERT INTO agent_tasks (agent_id, niche_id, title, description, status)
    VALUES (${writerId}, ${niche.id}, ${writerTitle}, ${writerDescription}, 'pending')
  `;

  const writerTaskRows = await sql`
    SELECT id FROM agent_tasks
    WHERE agent_id = ${writerId} AND niche_id = ${niche.id} AND title = ${writerTitle}
    ORDER BY created_at DESC LIMIT 1
  `;
  const writerTaskId = (writerTaskRows[0] as { id: string }).id;

  try {
    const { executeTask } = await import("~/services/agent-executor");
    const writerResult = await executeTask(writerTaskId);
    steps.push({
      step: 3,
      agent: "AI Writer Agent",
      taskId: writerTaskId,
      success: writerResult.success,
      summary: writerResult.success
        ? `Wrote article: "${firstArticleTitle}"`
        : "Article writing failed",
      error: writerResult.error,
    });

    // Save article to database if writer succeeded
    let savedArticle: { id: string; slug: string; title: string } | undefined;
    if (writerResult.success) {
      try {
        savedArticle = await saveArticleFromWriterResult(
          niche.id,
          firstArticleTitle,
          writerResult.result,
        );
      } catch (saveErr) {
        console.error("Failed to save article to DB:", saveErr);
        // Don't fail the pipeline — the article was still written
      }
    }

    const allSucceeded = steps.every((s) => s.success);
    return {
      success: allSucceeded,
      nicheSlug,
      nicheName: niche.niche_name,
      steps,
      article: savedArticle,
    };
  } catch (err) {
    steps.push({
      step: 3,
      agent: "AI Writer Agent",
      taskId: writerTaskId,
      success: false,
      summary: "Article writing failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, nicheSlug, nicheName: niche.niche_name, steps, error: "Writer step failed" };
  }
}

// Internal type for the pipeline
type ExecuteTaskResultForPipeline = Awaited<ReturnType<typeof executeTask>>;

/**
 * Parse the writer LLM result and save it as an article in the database.
 * Returns the saved article's id, slug, and title.
 */
async function saveArticleFromWriterResult(
  nicheId: string,
  articleTitle: string,
  writerResult: unknown,
): Promise<{ id: string; slug: string; title: string }> {
  const sql = getSql();

  // Extract article content from the writer result
  let content = "";
  let excerpt = "";
  let seoKeywords: string[] = [];
  let metaDescription = "";

  if (typeof writerResult === "object" && writerResult !== null) {
    const r = writerResult as Record<string, unknown>;

    // Try common field names for content
    content = String(
      r.content ?? r.article ?? r.body ?? r.text ?? r.output ?? JSON.stringify(writerResult, null, 2),
    );

    // Try to extract title if present
    if (r.title && typeof r.title === "string") {
      articleTitle = r.title;
    }

    // Extract excerpt
    excerpt = String(r.excerpt ?? r.summary ?? r.description ?? "");

    // Extract keywords
    if (Array.isArray(r.keywords ?? r.seo_keywords ?? r.tags)) {
      seoKeywords = (r.keywords ?? r.seo_keywords ?? r.tags) as string[];
    }

    // Meta description
    metaDescription = String(r.meta_description ?? r.metaDescription ?? r.excerpt ?? "");
  } else if (typeof writerResult === "string") {
    content = writerResult;
  }

  // Generate a slug from the title
  const slug = articleTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 120);

  // Count words
  const wordCount = content
    .replace(/[#*`>\-\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  // Generate excerpt if empty (first 200 chars of content)
  if (!excerpt) {
    excerpt = content
      .replace(/[#*`>\-\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);
    if (content.length > 200) excerpt += "...";
  }

  // Insert into articles table
  const result = await sql`
    INSERT INTO articles (niche_id, title, slug, content, excerpt, word_count, status, seo_keywords, meta_description, published_at)
    VALUES (${nicheId}, ${articleTitle}, ${slug}, ${content}, ${excerpt}, ${wordCount}, 'published', ${seoKeywords}, ${metaDescription}, NOW())
    ON CONFLICT (niche_id, slug)
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      excerpt = EXCLUDED.excerpt,
      word_count = EXCLUDED.word_count,
      seo_keywords = EXCLUDED.seo_keywords,
      meta_description = EXCLUDED.meta_description,
      published_at = EXCLUDED.published_at
    RETURNING id
  `;

  const articleId = (result[0] as { id: string }).id;

  // Save to media_assets for the gallery
  try {
    // Get the writer agent
    const writerAgent = await sql`
      SELECT id FROM ai_agents WHERE role = 'writer' LIMIT 1
    `;
    const writerId = writerAgent.length > 0 ? (writerAgent[0] as { id: string }).id : null;

    await sql`
      INSERT INTO media_assets (agent_id, niche_id, type, title, content, metadata, created_at)
      VALUES (
        ${writerId},
        ${nicheId},
        'article',
        ${articleTitle},
        ${excerpt},
        ${JSON.stringify({
          article_id: articleId,
          article_slug: slug,
          word_count: wordCount,
          seo_keywords: seoKeywords,
          meta_description: metaDescription,
        })},
        NOW()
      )
    `;
  } catch (mediaErr) {
    console.error("Failed to log article to media_assets:", mediaErr);
  }

  return { id: articleId, slug, title: articleTitle };
}
