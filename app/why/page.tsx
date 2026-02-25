import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why We Built Mentat',
  description: 'Software is moving to the terminal. AI tools are exploding. Nobody is solving which tool to use when. That\'s Mentat.',
  openGraph: {
    title: 'Why We Built Mentat',
    description: 'The tool ecosystem is growing faster than any developer can track. Mentat routes you to the right one.',
    type: 'website',
  },
};

export default function WhyPage() {
  return (
    <div className="min-h-screen bg-black text-green-400">
      <div className="max-w-4xl mx-auto px-4 py-16 font-mono">
        {/* Header */}
        <div className="mb-4">
          <Link href="/" className="text-green-600 hover:text-green-500 text-sm">
            ← Back to home
          </Link>
        </div>

        {/* Title */}
        <div className="mb-16">
          <div className="text-green-500 mb-8">
            <pre className="text-sm">
{`┌─────────────────────────────────────────────────┐
│                                                 │
│           WHY WE BUILT MENTAT                   │
│                                                 │
└─────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>

        {/* The Shift */}
        <section className="mb-16">
          <h2 className="text-xl mb-4 text-green-400">
            <span className="text-gray-500">$</span> the-shift
          </h2>
          <div className="text-gray-300 space-y-4 text-base leading-relaxed">
            <p>
              Software is moving to the terminal.
            </p>
            <p className="text-gray-400">
              Vercel, Stripe, Supabase, Cloudflare, Netlify, Planetscale &mdash; every serious
              dev tool now ships a CLI. Not as an afterthought. As the primary interface.
            </p>
            <p className="text-gray-400">
              At the same time, developers are building with AI agents in the terminal.
              Claude Code, Cursor, Windsurf &mdash; this is where code gets written now.
              Not in browsers. Not in dashboards. In the terminal, talking to an AI.
            </p>
            <p>
              These two trends are converging. And the intersection is where Mentat lives.
            </p>
          </div>
        </section>

        {/* The Pain */}
        <section className="border border-green-800 bg-gray-950 rounded p-8 mb-16">
          <h2 className="text-xl mb-6 text-green-400">
            <span className="text-gray-500">$</span> the-pain
          </h2>
          <div className="text-gray-300 space-y-4 text-base leading-relaxed">
            <p>
              You&apos;re building. You&apos;re in the terminal. You hit a wall.
            </p>
            <div className="bg-black border border-gray-800 rounded p-4 text-sm space-y-2">
              <p className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Deploy this to Vercel with preview URLs for each PR&quot;</span></p>
              <p className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Set up Stripe webhooks with signature verification&quot;</span></p>
              <p className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Migrate this Postgres schema without downtime&quot;</span></p>
              <p className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Debug why my Docker build is 2GB&quot;</span></p>
            </div>
            <p className="text-gray-400">
              You type a prompt. Your AI gives you a plausible answer.
              But plausible isn&apos;t correct. It hallucinated a CLI flag. It used the old API.
              It wrote a migration that would lock your table in production.
            </p>
            <p className="text-gray-400">
              So you go verify. Open docs. Google. Read Stack Overflow. Come back. Re-prompt
              with corrections. Go back and forth 4-5 times.
            </p>
            <p>
              You became the glue between your AI and the tools that could&apos;ve
              done this right the first time.
            </p>
            <p className="text-gray-400">
              The Vercel CLI exists. The Stripe CLI exists. There&apos;s an MCP server for your database.
              There&apos;s a Docker optimization tool. A test generation agent that understands
              coverage gaps.
            </p>
            <p>
              These tools exist. You just didn&apos;t know about them.
            </p>
          </div>
        </section>

        {/* The Problem Getting Worse */}
        <section className="mb-16">
          <h2 className="text-xl mb-6 text-green-400">
            <span className="text-gray-500">$</span> why-its-getting-worse
          </h2>
          <div className="text-gray-300 space-y-4 text-base leading-relaxed">
            <p className="text-gray-400">
              The number of dev tools, CLIs, MCP servers, and agent services is exploding.
              Every week there&apos;s a new one. Some are incredible. Most are noise.
              Nobody has time to evaluate them all.
            </p>
            <p className="text-gray-400">
              So developers default to raw-prompting their AI for everything. And the AI does its
              best with no tools &mdash; which means generic, sometimes-wrong answers to problems
              that already have purpose-built solutions.
            </p>
            <div className="border-l-2 border-green-700 pl-6 py-2">
              <p>
                More tools + same human bottleneck = more wasted potential.
              </p>
            </div>
            <p className="text-gray-400">
              Better models don&apos;t fix this. They make it worse. More capability means more things
              you could ask for, which means more prompts you have to get right, more tools you
              could be using but aren&apos;t.
            </p>
          </div>
        </section>

        {/* The Solution */}
        <section className="border border-green-800 bg-gray-950 rounded p-8 mb-16">
          <h2 className="text-xl mb-6 text-green-400">
            <span className="text-gray-500">$</span> the-solution
          </h2>
          <div className="text-gray-300 space-y-4 text-base leading-relaxed">
            <p>
              Mentat sits between you and everything that exists.
            </p>
            <div className="space-y-4 mt-6">
              <div className="border-l-2 border-green-700 pl-6">
                <p className="text-gray-400">
                  You say <span className="text-green-400">&quot;deploy this with preview URLs.&quot;</span>
                </p>
                <p className="text-gray-500 text-sm">
                  Mentat sees your project is on Vercel, routes to the right CLI, applies the right config. Done.
                </p>
              </div>

              <div className="border-l-2 border-green-700 pl-6">
                <p className="text-gray-400">
                  You say <span className="text-green-400">&quot;migrate this schema safely.&quot;</span>
                </p>
                <p className="text-gray-500 text-sm">
                  Mentat routes to the right database tool with the right context &mdash; your schema, your ORM, your provider.
                </p>
              </div>

              <div className="border-l-2 border-green-700 pl-6">
                <p className="text-gray-400">
                  You say <span className="text-green-400">&quot;write real tests for this module.&quot;</span>
                </p>
                <p className="text-gray-500 text-sm">
                  No free tool does this well. Mentat routes to a paid agent that specializes in test generation.
                  $3. Done in 2 minutes. You didn&apos;t even know this service existed.
                </p>
              </div>
            </div>
            <p className="mt-6">
              Free skills. Free CLIs. Free MCP servers. Paid agents when nothing free cuts it.
              All routed automatically based on what you asked and what your project looks like.
            </p>
            <div className="bg-black border border-gray-800 rounded p-4 text-sm mt-4">
              <p className="text-green-400">One catalog. One interface. Right tool, first try.</p>
            </div>
          </div>
        </section>

        {/* The Secret */}
        <section className="border border-green-600 bg-green-950 rounded p-8 mb-16">
          <h2 className="text-xl mb-6 text-green-400">
            <span className="text-gray-500">$</span> what-we-know
          </h2>
          <div className="text-gray-300 space-y-4 text-base leading-relaxed">
            <p>
              Everyone is building more AI tools. Nobody is solving which tool to use when.
            </p>
            <p className="text-gray-400">
              Everyone thinks the bottleneck is model intelligence. Build smarter models,
              get better output.
            </p>
            <p className="text-gray-400">
              Wrong. The bottleneck is context assembly. The right files, the right constraints,
              the right approach for this specific task in this specific project. That&apos;s a
              curation problem, not an AI problem. Better models don&apos;t solve it &mdash; they
              make it worse because the surface area of possible tasks keeps expanding.
            </p>
            <div className="border-l-2 border-green-400 pl-6 py-2 mt-4">
              <p className="text-green-400">
                Anthropic builds the engine. Tool makers build the tools.
                Nobody is building the index that connects intent to the right tool
                in the right context.
              </p>
              <p className="text-green-400 mt-2">
                That&apos;s Mentat.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border border-green-800 bg-gray-950 rounded p-8 mb-16">
          <h2 className="text-xl mb-6 text-green-400">
            <span className="text-gray-500">$</span> how-it-works
          </h2>
          <div className="space-y-6">
            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-1 text-green-400">[1] Install</h3>
              <div className="bg-black border border-gray-800 rounded p-3 text-sm text-green-400 mt-2">
                <span className="text-gray-600">$</span> npx mentat-mcp
              </div>
              <p className="text-gray-500 text-sm mt-2">30 seconds. Works with Claude Code out of the box.</p>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-1 text-green-400">[2] Ask for what you need</h3>
              <p className="text-gray-400 text-sm">
                In plain english. Mentat figures out which tool to use.
              </p>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-1 text-green-400">[3] Get routed to the right solution</h3>
              <p className="text-gray-400 text-sm">
                Free skill, community CLI, or paid agent &mdash; whatever fits.
                No config. No research. No trial and error.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center mb-16">
          <div className="bg-black border border-gray-800 rounded p-4 text-sm mb-8 inline-block">
            <span className="text-gray-600">$</span> <span className="text-green-400">npx mentat-mcp</span>
          </div>
          <p className="text-gray-500 text-sm">
            <Link href="/" className="text-green-600 hover:text-green-500">
              ← Get started
            </Link>
            <span className="mx-4">|</span>
            <Link href="/for-agents" className="text-green-600 hover:text-green-500">
              Build on Mentat →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
