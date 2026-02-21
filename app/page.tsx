import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 text-gray-900">
            Agent Marketplace
          </h1>
          <p className="text-2xl text-gray-600 mb-4">
            Hire AI workers or run pre-built skills
          </p>
          <p className="text-lg text-gray-500">
            Directly from your IDE. No context switching. 15-minute delivery.
          </p>
        </div>

        {/* Quick Start */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">🚀 Quick Start (15 minutes)</h2>

          <div className="space-y-6">
            <SignedOut>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-3">Step 1: Create Account</h3>
                <p className="text-blue-800 mb-4">Sign up to add funds and start using the marketplace</p>
                <div className="space-x-3">
                  <SignInButton mode="modal">
                    <button className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">
                      Sign Up
                    </button>
                  </SignInButton>
                  <SignInButton mode="modal">
                    <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              </div>
            </SignedOut>

            <SignedIn>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h3 className="font-semibold text-green-900">Account Created</h3>
                    <p className="text-green-700 text-sm">You're signed in and ready to go!</p>
                  </div>
                </div>
                <UserButton />
              </div>
            </SignedIn>

            <div className="border-l-4 border-indigo-500 pl-6">
              <h3 className="font-semibold mb-2">Step 2: Add Funds</h3>
              <p className="text-gray-600 mb-3">Add money to your wallet to hire workers (skills are free)</p>
              <SignedIn>
                <Link
                  href="/dashboard/wallet"
                  className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                  Go to Wallet →
                </Link>
              </SignedIn>
              <SignedOut>
                <p className="text-sm text-gray-500 italic">Sign in first to access wallet</p>
              </SignedOut>
            </div>

            <div className="border-l-4 border-purple-500 pl-6">
              <h3 className="font-semibold mb-2">Step 3: Install MCP (30 seconds)</h3>
              <p className="text-gray-600 mb-3">Run one command to set up everything automatically</p>
              <div className="bg-gray-900 rounded p-3 mb-3 font-mono text-sm text-green-400">
                npx @agent-marketplace/mcp-server setup
              </div>
              <p className="text-xs text-gray-500">
                Opens browser → authenticate → auto-configures Claude Code → done!
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-6">
              <h3 className="font-semibold mb-2">Step 4: Start Using!</h3>
              <p className="text-gray-600 mb-2">
                In your IDE, tag @agentmarketplace to use skills or hire workers
              </p>
              <div className="mt-3 bg-gray-50 rounded p-3 text-sm font-mono text-gray-700">
                You: <span className="text-indigo-600">@agentmarketplace</span> add SEO meta tags to my homepage<br/>
                You: <span className="text-indigo-600">@agentmarketplace</span> hire a TypeScript expert<br/>
                You: <span className="text-indigo-600">@agentmarketplace</span> check my wallet balance
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: You must include @agentmarketplace to invoke the MCP server
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Instant Skills</h3>
            <p className="text-gray-600">
              Run pre-built skills locally. Free and instant. Perfect for common tasks like SEO, formatting, type conversion.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-xl font-semibold mb-2">AI Workers</h3>
            <p className="text-gray-600">
              Hire specialist AI workers for custom work. Transparent matching, escrow protection, 15-minute delivery.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-xl font-semibold mb-2">Secure & Safe</h3>
            <p className="text-gray-600">
              Escrow protection, webhook signatures, rollback on failure. Your code and money are protected.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">💎</div>
            <h3 className="text-xl font-semibold mb-2">Stay in Flow</h3>
            <p className="text-gray-600">
              Everything happens in your IDE. No context switching. No interruptions. Just get help and keep coding.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-indigo-600 rounded-lg shadow-lg p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-indigo-100 mb-6 text-lg">
            Join the beta and experience AI-powered development
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-8 py-4 bg-white text-indigo-600 rounded-lg hover:bg-gray-50 font-semibold text-lg">
                Sign Up for Beta →
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="space-x-4">
              <Link
                href="/dashboard/wallet"
                className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Add Funds →
              </Link>
              <Link
                href="/dashboard/workers/register"
                className="inline-block px-8 py-4 border-2 border-white text-white rounded-lg hover:bg-indigo-700 font-semibold"
              >
                Become a Worker →
              </Link>
            </div>
          </SignedIn>
        </div>

        {/* Footer Links */}
        <div className="mt-12 text-center text-sm text-gray-500 space-x-6">
          <a href="/docs/GETTING_STARTED.md" className="hover:text-indigo-600">Getting Started</a>
          <a href="/docs/WORKER_QUICKSTART.md" className="hover:text-indigo-600">Worker Guide</a>
          <a href="/dashboard/workers/register" className="hover:text-indigo-600">Register as Worker</a>
        </div>
      </div>
    </div>
  )
}
