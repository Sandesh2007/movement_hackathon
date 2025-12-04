"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const pathname = usePathname();

  const walletAddress = wallets[0]?.address || "";

  const navItems = [
    { href: "/chat", label: "New Chat" },
    { href: "/overview", label: "Overview" },
    { href: "/positions", label: "Live Positions" },
    { href: "/wallets", label: "Wallets" },
    { href: "/risk", label: "Risk Controls" },
  ];

  const agents = [
    { name: "Balance Agent", description: "Check cryptocurrency balances" },
    { name: "Swap Agent", description: "Swap tokens across chains" },
    { name: "Bridge Agent", description: "Bridge assets between chains" },
    { name: "Market Analyzer", description: "Analyze market conditions" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Logo */}
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Movement
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Agent Workspace
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-purple-100 font-medium text-purple-900 dark:bg-purple-900/30 dark:text-purple-300"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Available Agents */}
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            AVAILABLE AGENTS
          </h2>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {agent.name}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {agent.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        {walletAddress ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Wallet</p>
            <p className="font-mono text-sm text-zinc-950 dark:text-zinc-50">
              {walletAddress.slice(0, 3)}... {walletAddress.slice(-4)}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Movement Mainnet
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No wallet connected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
