/**
 * Transfer API Route
 *
 * Server-side endpoint for building and submitting Movement Network token transfers.
 * This is required because @aptos-labs/ts-sdk has Node.js dependencies (got) that
 * cannot run in the browser.
 *
 * Based on Privy Movement Network documentation:
 * https://docs.privy.io/recipes/use-tier-2#movement
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/node";
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
} from "@aptos-labs/ts-sdk";
import { toHex } from "viem";

const privy = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});


// Movement Network configuration - Mainnet
// const MOVEMENT_NETWORK = Network.MAINNET;
// const MOVEMENT_FULLNODE = "https://full.mainnet.movementinfra.xyz/v1";

// Movement Network configuration - Mainnet
const MOVEMENT_NETWORK = Network.TESTNET;
const MOVEMENT_FULLNODE = "https://testnet.movementnetwork.xyz/v1";

const aptos = new Aptos(
  new AptosConfig({
    network: MOVEMENT_NETWORK,
    fullnode: MOVEMENT_FULLNODE
  })
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(`${process.env.NEXT_PUBLIC_PRIVY_APP_ID} ${process.env.PRIVY_APP_SECRET}`)

    const walletId = 'qsziu96q8klci74l9wzz35us';
const publicKey = '004a4b8e3536ed0a9867ab85ae0108550a9e7b82958730fb50c2affebb9a11f3c9'; // 32-byte ed25519 public key hex
const address = AccountAddress.from('0x5eab3cef1bd13a0f5fdc0dfc22e99a56df5360fd9b48c5dcc4467e3129907498');

// 2) Build the raw transaction (SDK fills in seq#, chainId, gas if you let it)
const rawTxn = await aptos.transaction.build.simple({
  sender: address,
  data: {
    function: '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    functionArguments: ['0x31c8dbb5f226f6df7d276eec91de31cd3152a90ee2ca45767b5a7f5a62cdf25', 1] // amount in Octas
  }
});

const message = generateSigningMessageForTransaction(rawTxn);
console.log(`message: ${message}`)
const wallet = await privy.wallets().get(walletId);
console.log(`wallet: ${JSON.stringify(wallet)}`)
const signatureResponse = await privy.wallets().rawSign(walletId, {params: {hash: toHex(message)}});

console.log(`signatureResponse: ${signatureResponse}`)
const signature = signatureResponse as unknown as string;

console.log(`signature: ${signature}`)

// 5) Wrap pk + signature in an authenticator and submit
const senderAuthenticator = new AccountAuthenticatorEd25519(
  new Ed25519PublicKey(publicKey),
  new Ed25519Signature(signature.slice(2))
);

console.log(`senderAuthenticator: ${senderAuthenticator}`)

const pending = await aptos.transaction.submit.simple({
  transaction: rawTxn,
  senderAuthenticator
});

const executed = await aptos.waitForTransaction({
  transactionHash: pending.hash
});

    return NextResponse.json({
      success: true,
      transactionHash: executed.hash,
      status: executed.success ? "success" : "failed",
    });
  } catch (error: any) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute transfer" },
      { status: 500 }
    );
  }
}

