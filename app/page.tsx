import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-green-400">
      <div className="max-w-4xl mx-auto px-4 py-16 font-mono">
        {/* Navigation */}
        <nav className="mb-8 flex justify-end space-x-4 text-sm">
          <Link href="/why" className="text-green-600 hover:text-green-500">
            Why Mentat →
          </Link>
          <Link href="/for-agents" className="text-green-600 hover:text-green-500">
            For AI Agents →
          </Link>
        </nav>

        {/* Hero */}
        <div className="mb-16">
          <div className="text-green-500 mb-8">
            <pre className="text-sm">
{`┌─────────────────────────────────────────────────┐
│                                                 │
│                    MENTAT                        │
│                                                 │
└─────────────────────────────────────────────────┘`}
            </pre>
          </div>
          <p className="text-xl mb-2">
            <span className="text-gray-500">$</span> The right tool, first try
          </p>
          <p className="text-base text-gray-400">
            <span className="text-gray-600">→</span> Skills, CLIs, and agents — routed from your terminal. No research. No config.
          </p>
        </div>

        {/* Quick Start */}
        <div className="border border-green-800 bg-gray-950 rounded p-8 mb-12">
          <h2 className="text-xl mb-6 text-green-400">$ ./quick-start</h2>

          <div className="space-y-6">
            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[1/3] Install (30s)</h3>
              <p className="text-gray-400 mb-3">One command. Works with Claude Code out of the box.</p>
              <div className="bg-black border border-gray-800 rounded p-3 mb-3 text-sm text-green-400">
                <span className="text-gray-600">$</span> npx mentat-mcp
              </div>
              <p className="text-xs text-gray-600">
                // Opens browser → auth → configures Claude → done
              </p>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[2/3] Ask for what you need</h3>
              <p className="text-gray-400 mb-3">
                Describe the problem. Mentat figures out which tool to use.
              </p>
              <div className="bg-black border border-gray-800 rounded p-3 text-sm space-y-2">
                <div className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Deploy this to Vercel with preview URLs for each PR&quot;</span></div>
                <div className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Migrate this Postgres schema without downtime&quot;</span></div>
                <div className="text-gray-500"><span className="text-green-600">$</span> <span className="text-green-400">&quot;Write real tests for this module — not boilerplate&quot;</span></div>
              </div>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[3/3] Get routed to the right solution</h3>
              <p className="text-gray-400 mb-3">
                Free skill, community CLI, or paid agent — whatever fits best.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p><span className="text-green-600">→</span> <span className="text-gray-400">Free skills</span> run instantly, right in your project</p>
                <p><span className="text-green-600">→</span> <span className="text-gray-400">Paid agents</span> handle complex work, delivered in minutes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="border border-green-800 bg-gray-950 rounded p-8 mb-12">
          <h2 className="text-xl mb-6 text-green-400">$ ./account</h2>

          <SignedOut>
            <p className="text-gray-400 mb-4">Sign up to unlock paid agents and track usage.</p>
            <div className="space-x-3">
              <SignInButton mode="modal">
                <button className="px-6 py-2 bg-green-600 text-black rounded hover:bg-green-500 font-medium">
                  Sign Up
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="px-6 py-2 border border-green-600 text-green-400 rounded hover:bg-gray-800 font-medium">
                  Sign In
                </button>
              </SignInButton>
            </div>
            <p className="text-xs text-gray-600 mt-4">
              // Free skills work without an account
            </p>
          </SignedOut>

          <SignedIn>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-green-400">✓</span>
                <div>
                  <p className="font-semibold text-green-400">Signed in</p>
                  <p className="text-gray-400 text-sm">You're all set — run skills from your terminal.</p>
                </div>
              </div>
              <UserButton />
            </div>
            <p className="mt-3 text-xs text-gray-600">
              <Link href="/wallet" className="hover:text-gray-400">manage wallet →</Link>
            </p>
          </SignedIn>
        </div>
      </div>
    </div>
  )
}
