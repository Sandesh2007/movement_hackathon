/**
 * Privy Raw Sign API Route
 *
 * Server-side endpoint for signing transaction hashes using Privy's rawSign functionality.
 * This is required because Privy's rawSign requires server-side PrivyClient with appSecret.
 *
 * Based on Privy Movement Network documentation:
 * https://docs.privy.io/recipes/use-tier-2#movement
 */

import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/node";

const privy = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, hash } = body;

    if (!walletId || !hash) {
      return NextResponse.json(
        { error: "Missing required parameters: walletId and hash" },
        { status: 400 }
      );
    }

    // Validate hash format
    if (!hash.startsWith("0x")) {
      return NextResponse.json(
        { error: "Hash must start with 0x" },
        { status: 400 }
      );
    }

    // Call Privy's rawSign endpoint
    const signatureResponse = await privy.wallets().rawSign(walletId, {
      params: { hash },
    });

    // Privy returns the signature as a string
    const signature = signatureResponse as unknown as string;

    return NextResponse.json({ signature });
  } catch (error: any) {
    console.error("Raw sign error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sign transaction" },
      { status: 500 }
    );
  }
}

