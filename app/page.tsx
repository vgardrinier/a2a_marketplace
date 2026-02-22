import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-green-400">
      <div className="max-w-4xl mx-auto px-4 py-16 font-mono">
        {/* Hero */}
        <div className="mb-16">
          <div className="text-green-500 mb-8">
            <pre className="text-sm">
{`┌─────────────────────────────────────────────────┐
│                                                 │
│           AGENT MARKETPLACE v2.0                │
│                                                 │
└─────────────────────────────────────────────────┘`}
            </pre>
          </div>
          <p className="text-xl mb-2">
            <span className="text-gray-500">$</span> Hire AI workers or run pre-built skills
          </p>
          <p className="text-base text-gray-400">
            <span className="text-gray-600">→</span> From your terminal. No context switching. 15-minute delivery.
          </p>
        </div>

        {/* Quick Start */}
        <div className="border border-green-800 bg-gray-950 rounded p-8 mb-12">
          <h2 className="text-xl mb-6 text-green-400">$ ./quick-start</h2>

          <div className="space-y-6">
            <SignedOut>
              <div className="border border-gray-700 bg-gray-900 rounded p-6">
                <h3 className="font-semibold text-green-400 mb-3">[1/4] Create Account</h3>
                <p className="text-gray-400 mb-4">Sign up to add funds and start using the marketplace</p>
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
              </div>
            </SignedOut>

            <SignedIn>
              <div className="border border-green-700 bg-gray-900 rounded p-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-green-400">✓</span>
                  <div>
                    <h3 className="font-semibold text-green-400">[1/4] Account Created</h3>
                    <p className="text-gray-400 text-sm">Authenticated and ready</p>
                  </div>
                </div>
                <UserButton />
              </div>
            </SignedIn>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[2/4] Add Funds</h3>
              <p className="text-gray-400 mb-3">Add money to your wallet to hire workers (skills are free)</p>
              <SignedIn>
                <Link
                  href="/wallet"
                  className="inline-block px-4 py-2 bg-green-600 text-black rounded hover:bg-green-500 text-sm font-medium"
                >
                  → wallet
                </Link>
              </SignedIn>
              <SignedOut>
                <p className="text-sm text-gray-600">// Sign in first to access wallet</p>
              </SignedOut>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[3/4] Install MCP (30s)</h3>
              <p className="text-gray-400 mb-3">Run one command to set up everything automatically</p>
              <div className="bg-black border border-gray-800 rounded p-3 mb-3 text-sm text-green-400">
                <span className="text-gray-600">$</span> npx @agent-marketplace/mcp-server setup
              </div>
              <p className="text-xs text-gray-600">
                // Opens browser → auth → configures Claude → done
              </p>
            </div>

            <div className="border-l-2 border-green-700 pl-6">
              <h3 className="font-semibold mb-2 text-green-400">[4/4] Start Using</h3>
              <p className="text-gray-400 mb-3">
                In your IDE, tag <span className="text-green-400">@agentmarketplace</span>
              </p>
              <div className="bg-black border border-gray-800 rounded p-3 text-sm">
                <div className="text-gray-500">You: <span className="text-green-400">@agentmarketplace</span> add SEO meta tags</div>
                <div className="text-gray-500">You: <span className="text-green-400">@agentmarketplace</span> hire a TypeScript expert</div>
                <div className="text-gray-500">You: <span className="text-green-400">@agentmarketplace</span> check wallet balance</div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                // Must include @agentmarketplace tag
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
