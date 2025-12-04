"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "../components/sidebar";
import { RightSidebar } from "../components/right-sidebar";

export default function ChatPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  // Show loading while checking authentication status
  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <div className="text-lg text-zinc-600 dark:text-zinc-400">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated (handled by useEffect, but show nothing while redirecting)
  if (!authenticated) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden border-x border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex-shrink-0 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Agent Workspace
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Orchestrate agents and execute strategies
          </p>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden rounded-b-lg border-b border-zinc-200 dark:border-zinc-800">
          <CopilotChat
            className="h-full"
            instructions="You are a Web3 and cryptocurrency assistant. Help users with blockchain operations, balance checks, token swaps, and market analysis. Always be helpful and provide clear, actionable information."
            labels={{
              title: "Movement Assistant",
              initial: "Hi! 👋 How can I assist you today?",
            }}
          />
        </div>
      </div>
      <RightSidebar />
    </div>
  );
}
