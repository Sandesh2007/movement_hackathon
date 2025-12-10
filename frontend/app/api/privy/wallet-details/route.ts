/**
 * Privy Wallet Details API Route
 *
 * Server-side endpoint for fetching wallet details including public key from Privy.
 * This is required because some wallet details are only available via Privy's server API.
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
    const { walletId } = body;

    if (!walletId) {
      return NextResponse.json(
        { error: "Missing required parameter: walletId" },
        { status: 400 }
      );
    }

    // Get wallet details from Privy
    const wallet = await privy.wallets().get(walletId);

    // Extract public key - the structure may vary, so we check multiple possible fields
    const publicKey =
      (wallet as any).publicKey ||
      (wallet as any).ed25519PublicKey ||
      (wallet as any).aptosPublicKey ||
      null;

    if (!publicKey) {
      return NextResponse.json(
        { error: "Public key not found for this wallet" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      walletId: wallet.id,
      address: wallet.address,
      publicKey,
      chainType: (wallet as any).chainType,
    });
  } catch (error: any) {
    console.error("Get wallet details error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get wallet details" },
      { status: 500 }
    );
  }
}

