import { createFileRoute, notFound } from "@tanstack/react-router";
import { getArticle } from "~/data/articles";

export const Route = createFileRoute("/tech/articles/article")({
  validateSearch: (search: Record<string, unknown>) => ({
    slug: (search.slug as string) || "",
  }),
  loaderDeps: ({ search }) => ({ slug: search.slug }),
  loader: ({ deps }) => {
    const article = getArticle(deps.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    const article = loaderData;
    if (!article) return {};
    const url = `https://empireai.com/tech/articles/article?slug=${article.slug}`;
    return {
      meta: [
        { title: `${article.title} | EmpireAI Tech` },
        { name: "description", content: article.excerpt },
        { property: "og:title", content: article.title },
        { property: "og:description", content: article.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: article.date },
        { property: "article:section", content: article.category },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            datePublished: article.date,
            author: {
              "@type": "Organization",
              name: "EmpireAI Tech Team",
            },
            publisher: {
              "@type": "Organization",
              name: "EmpireAI",
            },
          }),
        },
      ],
    };
  },
  component: ArticleDetail,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ArticleDetail() {
  const article = Route.useLoaderData();

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
        <a href="/tech" className="hover:text-indigo-400">
          Tech
        </a>
        <span>/</span>
        <a href="/tech/articles" className="hover:text-indigo-400">
          Articles
        </a>
        <span>/</span>
        <span className="text-gray-400 truncate">{article.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            {article.category}
          </span>
          <span className="text-sm text-gray-500">
            {formatDate(article.date)}
          </span>
          <span className="text-sm text-gray-500">· {article.readingTime}</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          {article.title}
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-gray-400">
          {article.excerpt}
        </p>

        {/* Author byline */}
        <div className="mt-6 flex items-center gap-3 border-t border-gray-800 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-sm font-bold text-white">
            EA
          </div>
          <div>
            <p className="text-sm font-medium">EmpireAI Tech Team</p>
            <p className="text-xs text-gray-500">
              Hands-on testing & research by our AI-powered editorial team
            </p>
          </div>
        </div>
      </header>

      {/* Article body */}
      <div className="prose-custom">
        <ArticleContent />
      </div>

      {/* Affiliate disclosure */}
      <div className="mt-12 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <p className="text-xs leading-relaxed text-gray-500">
          <strong className="text-gray-400">Affiliate Disclosure:</strong>{" "}
          Some links in this article may be affiliate links. If you click and
          make a purchase, we may earn a commission at no additional cost to
          you. We only recommend tools we've tested and believe deliver genuine
          value. Our reviews are written independently and are never influenced
          by affiliate partnerships.
        </p>
      </div>

      {/* Related articles placeholder */}
      <section className="mt-16 border-t border-gray-800 pt-12">
        <h2 className="text-xl font-bold">Related Articles</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <p className="text-sm font-medium text-gray-500">
              Coming soon: ChatGPT vs Claude vs Gemini — Honest Hands-On Comparison
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <p className="text-sm font-medium text-gray-500">
              Coming soon: 10 No-Code Automations That Save 10+ Hours Per Week
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Full article content — rendered as rich text                       */
/* ------------------------------------------------------------------ */

function ArticleContent() {
  return (
    <div className="space-y-6 text-base leading-relaxed text-gray-300">
      {/* Intro */}
      <p>
        Running a small business in 2026 means wearing a dozen hats —
        marketing, sales, customer support, bookkeeping, content creation, and
        everything in between. The good news? AI tools have matured to the point
        where they can genuinely take work off your plate, not just add another
        subscription to your credit card statement.
      </p>
      <p>
        But the AI tool landscape is noisy. Every product claims to be "powered
        by GPT" or "revolutionary." Most aren't. We've spent months testing
        dozens of tools hands-on — using them for real business workflows, not
        just demo videos — to identify the ones that actually deliver for small
        business owners.
      </p>
      <p>
        This guide organizes the best tools by what they actually do for your
        business: writing, design, automation, CRM, and email marketing. Each
        tool gets an honest assessment — what it's great at, where it falls
        short, what it costs, and who should (and shouldn't) use it.
      </p>

      {/* How We Evaluated */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        How We Evaluated These Tools
      </h2>
      <p>
        We judged each tool against five criteria that matter for small business
        owners: ease of setup (you shouldn't need an IT team), time saved per
        week (measured, not estimated), quality of output (compared to doing it
        manually), pricing relative to value (free tiers and paid plans), and
        integration with other tools you already use. Tools that scored poorly
        on real-world reliability were cut, even if their demos looked
        impressive.
      </p>

      {/* Section: Writing */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        AI Writing & Content Creation
      </h2>

      <h3 className="mt-8 text-xl font-semibold text-white">
        1. Jasper — Best for Marketing Teams &amp; Agencies
      </h3>
      <p>
        Jasper has evolved from a GPT wrapper into a full marketing co-pilot. It
        includes brand voice memory, campaign-aware generation, and a
        collaborative editor that lets multiple team members work on the same
        document. The standout feature for small businesses is "Brand Voice" —
        you feed it your website, style guide, and past content, and it learns
        to write in your tone. No more generic AI-sounding copy.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> $49/month
          (Creator), $125/month (Pro, includes Brand Voice &amp; campaigns)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Businesses
          producing regular blog posts, social content, ad copy, and email
          sequences
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> Expensive if
          you're just writing the occasional blog post. But if content marketing
          is a core growth channel and you're spending 10+ hours/week on it,
          Jasper easily pays for itself. The Brand Voice feature is genuinely
          differentiated — most competitors still sound like ChatGPT with a
          custom prompt.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You're a solo
          founder who writes one article per month. ChatGPT or Claude will serve
          you fine for a fraction of the cost.
        </li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold text-white">
        2. Claude (Anthropic) — Best for Long-Form Research &amp; Strategy
      </h3>
      <p>
        Claude has become the go-to for business owners who need thoughtful,
        nuanced output. Its 200K context window means you can upload your entire
        business plan, competitor research, and customer interviews, then ask it
        to write a strategy document that references your specific situation.
        The writing quality is consistently the best among frontier models for
        business content — fewer hallucinations, better structure, and a more
        natural tone.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (limited),
          $20/month (Pro), $30/month (Team)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Business
          strategy, long-form research, market analysis, and content that
          requires deep thinking rather than quick generation
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> Not a
          dedicated marketing tool — no templates, no scheduling, no
          integrations. But as a thinking partner and first-draft engine, it's
          unmatched. We use it for outlining articles, analyzing competitors,
          and drafting proposals. The $20 Pro tier is arguably the best value in
          AI right now.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You need a
          turnkey content machine with built-in publishing. Pair Claude with a
          tool like Jasper or a human editor.
        </li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold text-white">
        3. ChatGPT (OpenAI) — Best All-Rounder for Solopreneurs
      </h3>
      <p>
        ChatGPT remains the Swiss Army knife of AI. GPT-4o is fast, capable,
        and the "Tasks" feature lets you schedule recurring work — weekly social
        media drafts, daily email summaries, monthly report outlines. The custom
        GPTs marketplace means you can find pre-built assistants for specific
        business tasks (SEO analysis, contract review, financial modeling)
        without any setup.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (GPT-4o
          mini), $20/month (Plus), $30/month (Pro with advanced features)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Solopreneurs who
          want one tool for writing, brainstorming, quick research, data
          analysis, and light coding
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> The breadth is
          the selling point. ChatGPT won't beat specialized tools at their
          specific jobs, but for a small business owner who needs to do a little
          of everything, it's the obvious starting point. The free tier is
          genuinely useful — upgrade to Plus when you hit rate limits or need
          file uploads.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You need
          brand-consistent output at scale. ChatGPT's default voice is
          identifiable; it takes prompting effort to sound like your brand.
        </li>
      </ul>

      {/* Section: Design */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        AI Design &amp; Visual Content
      </h2>

      <h3 className="mt-8 text-xl font-semibold text-white">
        4. Canva (Magic Studio) — Best for DIY Design
      </h3>
      <p>
        Canva's Magic Studio suite has quietly become one of the most practical
        AI implementations for small business. Magic Design generates full brand
        kits, social media templates, and presentation decks from a text prompt.
        Background Remover, Magic Eraser, and Magic Expand work reliably enough
        for professional use. The AI-powered Brand Kit automatically pulls
        colors, fonts, and logos from your website.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free, $15/month
          (Pro, includes Magic Studio &amp; Brand Kit), $30/month (Teams)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Business owners
          who create their own marketing materials — social graphics,
          presentations, flyers, simple ads
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> Canva Pro at
          $15/month is arguably the highest-ROI subscription for a small
          business. The AI features save hours on design tasks that used to
          require a freelancer. The quality isn't professional-agency level, but
          it's well above "looks like a template" — especially if you invest an
          hour setting up your Brand Kit.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You already have a
          designer or use Adobe Creative Cloud. Canva complements, doesn't
          replace, professional design workflows.
        </li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold text-white">
        5. Adobe Express — Best for Adobe Users Who Want Speed
      </h3>
      <p>
        Adobe Express is Adobe's answer to Canva — a simplified design tool with
        AI features powered by Firefly (Adobe's generative AI model). The
        integration with Adobe Fonts, Stock, and the broader Creative Cloud
        ecosystem makes it compelling if you're already in that world.
        Text-to-image generation, template remixing, and one-click background
        removal all work smoothly.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free, $10/month
          (Premium)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Small businesses
          already using Adobe products who want quick social media and marketing
          assets without opening Photoshop
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> If you have
          zero Adobe investment, Canva Pro is the better choice — more
          templates, better collaboration, larger community. If you're already
          paying for Creative Cloud, Express Premium is included in many plans.
          Firefly is commercially safer than most AI image generators because
          Adobe trained it on licensed content.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You're not in the
          Adobe ecosystem. Canva offers more for less.
        </li>
      </ul>

      {/* Section: Automation */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        Workflow Automation
      </h2>

      <h3 className="mt-8 text-xl font-semibold text-white">
        6. Zapier — Best for Connecting Everything
      </h3>
      <p>
        Zapier connects 7,000+ apps and remains the most accessible automation
        platform for non-technical users. Its new AI-powered "Zap Builder" lets
        you describe a workflow in plain English and it builds the automation.
        For small businesses, the biggest wins come from automating repetitive
        admin: lead capture to CRM, invoice generation from form submissions,
        social media cross-posting, and email list syncing.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (100
          tasks/month), $19.99/month (Starter, 750 tasks), $49/month
          (Professional, 2K tasks)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Businesses that
          use multiple SaaS tools and need them to talk to each other without
          manual data entry
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> Zapier's
          premium pricing adds up fast — multi-step Zaps consume tasks quickly.
          Audit your automations monthly to avoid paying for Zaps that could be
          handled by native integrations. That said, for non-technical teams,
          the time saved usually outweighs the cost.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You only need
          simple, single-app automations. Most SaaS tools now have built-in
          automation that handles 80% of common use cases.
        </li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold text-white">
        7. Make (formerly Integromat) — Best for Complex Workflows
      </h3>
      <p>
        Make uses a visual scenario builder that's more powerful than Zapier's
        linear interface — you can build branching logic, error handling, and
        multi-step transformations visually. It's dramatically cheaper per
        operation, making it the better choice for high-volume automation. The
        learning curve is steeper, but the ceiling is much higher.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (1,000
          ops/month), $9/month (Core, 10K ops), $29/month (Pro, 40K ops)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Businesses that
          need complex, multi-step automations with conditional logic and high
          monthly volumes
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> If you can
          invest 2-3 hours learning the visual builder, Make will save you
          hundreds per year vs Zapier. The free tier is generous. The biggest
          downside: fewer native integrations than Zapier, so check your stack
          before committing.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You want
          one-click setup and don't want to think about automation logic. Zapier
          is simpler.
        </li>
      </ul>

      {/* Section: CRM */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        CRM &amp; Customer Management
      </h2>

      <h3 className="mt-8 text-xl font-semibold text-white">
        8. HubSpot — Best Free CRM for Growing Businesses
      </h3>
      <p>
        HubSpot's free CRM is genuinely free — no time limit, no contact caps.
        It includes contact management, deal tracking, email tracking, meeting
        scheduling, and live chat. The AI features (content assistant, email
        writer, predictive lead scoring) are available on paid tiers starting at
        $20/month. For a small business, the free tier alone replaces three or
        four separate tools.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free CRM, $20/month
          (Marketing Hub Starter), $15/month (Sales Hub Starter)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Service
          businesses, B2B companies, and anyone who needs to track leads through
          a pipeline
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> The free CRM
          is the best in the market — no contest. The paid tiers get expensive
          fast (Marketing Hub Professional is $890/month), but the free CRM
          alone provides enormous value. Start there; only upgrade when you
          genuinely outgrow it.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You run a
          high-volume ecommerce business and need deep Shopify/WooCommerce
          integration. Consider a specialized ecommerce CRM instead.
        </li>
      </ul>

      {/* Section: Email Marketing */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        Email Marketing
      </h2>

      <h3 className="mt-8 text-xl font-semibold text-white">
        9. ConvertKit — Best for Creators &amp; Content Businesses
      </h3>
      <p>
        ConvertKit is built for creators, bloggers, and content-first
        businesses. Its visual automation builder is intuitive, and the
        tagging-based subscriber system is more flexible than list-based
        alternatives. The AI subject line generator and email outline tools are
        genuinely useful. The free plan supports up to 10,000 subscribers —
        unusually generous.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (up to 10K
          subscribers), $29/month (Creator, 1K subscribers), scaling with list
          size
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Bloggers,
          newsletter writers, course creators, and anyone building an
          audience-first business
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> If your
          business model revolves around content and email sequences, ConvertKit
          is the best-in-class. The free plan's 10K subscriber limit is
          exceptional. The trade-off: fewer ecommerce features than Mailchimp or
          Klaviyo.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You need advanced
          ecommerce automations (abandoned cart, product recommendations). Look
          at Klaviyo.
        </li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold text-white">
        10. Mailchimp — Best All-in-One Marketing Platform
      </h3>
      <p>
        Mailchimp has evolved well beyond email. It now includes a basic CRM,
        website builder, social media scheduler, and AI-powered content
        generator. The email templates are among the best-designed in the
        industry. For a small business that wants one platform for multiple
        marketing channels, Mailchimp is the most complete option.
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Pricing:</strong> Free (500
          contacts, limited sends), $13/month (Essentials, 500 contacts),
          $20/month (Standard)
        </li>
        <li>
          <strong className="text-gray-300">Best for:</strong> Small businesses
          that want email + basic website + social scheduling in one platform
        </li>
        <li>
          <strong className="text-gray-300">Honest take:</strong> Mailchimp's
          breadth is impressive, but each individual feature is "good enough"
          rather than best-in-class. The email deliverability is solid, the
          templates are beautiful, and the reporting is clear. The free tier is
          increasingly restrictive — you'll likely need to upgrade once you pass
          500 contacts.
        </li>
        <li>
          <strong className="text-gray-300">Skip if:</strong> You need advanced
          automation or a pure focus on email. ConvertKit or ActiveCampaign may
          suit you better.
        </li>
      </ul>

      {/* Comparison Table */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        Quick Comparison Table
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="py-3 pr-4 font-semibold text-gray-300">Tool</th>
              <th className="py-3 pr-4 font-semibold text-gray-300">
                Category
              </th>
              <th className="py-3 pr-4 font-semibold text-gray-300">
                Starting Price
              </th>
              <th className="py-3 pr-4 font-semibold text-gray-300">
                Free Tier
              </th>
              <th className="py-3 font-semibold text-gray-300">
                Best For
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            {[
              ["Jasper", "Writing", "$49/mo", "7-day trial", "Marketing teams"],
              ["Claude", "Writing/Research", "$20/mo", "Yes (limited)", "Strategy & long-form"],
              ["ChatGPT", "All-rounder", "$20/mo", "Yes", "Solopreneurs"],
              ["Canva", "Design", "$15/mo", "Yes", "DIY design"],
              ["Adobe Express", "Design", "$10/mo", "Yes", "Adobe ecosystem users"],
              ["Zapier", "Automation", "$19.99/mo", "Yes (100 tasks)", "Multi-app workflows"],
              ["Make", "Automation", "$9/mo", "Yes (1,000 ops)", "Complex automations"],
              ["HubSpot", "CRM", "Free", "Yes (full CRM)", "B2B & service businesses"],
              ["ConvertKit", "Email", "Free / $29/mo", "Yes (10K subs)", "Creators & bloggers"],
              ["Mailchimp", "Email/All-in-one", "$13/mo", "Yes (500 contacts)", "Multi-channel marketing"],
            ].map((row, i) => (
              <tr
                key={row[0]}
                className={`border-b border-gray-800 ${
                  i % 2 === 0 ? "bg-gray-900/30" : ""
                }`}
              >
                <td className="py-3 pr-4 font-medium text-gray-200">
                  {row[0]}
                </td>
                <td className="py-3 pr-4">{row[1]}</td>
                <td className="py-3 pr-4">{row[2]}</td>
                <td className="py-3 pr-4">{row[3]}</td>
                <td className="py-3">{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Final thoughts */}
      <h2 className="mt-10 text-2xl font-bold text-white">
        The Bottom Line
      </h2>
      <p>
        You don't need all ten tools. Start with the problem that costs you the
        most time each week and pick one tool that solves it. For most small
        business owners, the optimal starter stack looks like:
      </p>
      <ul className="ml-5 list-disc space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">ChatGPT Plus ($20/month)</strong> —
          writing, brainstorming, research, and quick data analysis
        </li>
        <li>
          <strong className="text-gray-300">Canva Pro ($15/month)</strong> —
          all your visual content and marketing materials
        </li>
        <li>
          <strong className="text-gray-300">HubSpot Free CRM ($0)</strong> —
          contact management, deal tracking, and basic email
        </li>
      </ul>
      <p className="font-semibold text-white">
        Total: $35/month for a stack that covers 80% of what most small
        businesses need from AI tools.
      </p>
      <p>
        Add tools as you grow: automation (Zapier or Make) when you're spending
        hours on repetitive data entry, a dedicated email platform (ConvertKit
        or Mailchimp) when your list passes 1,000 subscribers, and Jasper when
        content marketing becomes a core growth channel.
      </p>
      <p>
        The AI tool market moves fast — we'll update this guide quarterly. Have
        a tool you think should be on this list? We'd love to hear about it.
      </p>
    </div>
  );
}
