import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-950 border-b border-green-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center font-mono">
              <a href="/" className="text-green-400 font-bold">
                $ agentmarketplace
              </a>
            </div>
            <div className="flex items-center font-mono">
              <a
                href="/wallet"
                className="text-gray-600 hover:text-gray-400 text-xs"
              >
                wallet
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
