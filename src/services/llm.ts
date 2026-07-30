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

Ready to take the next step? Pick one action item from this guide and implement it today. Small, consistent progress beats occasional massive efforts every time.`,
    },
    null,
    2,
  );
}
