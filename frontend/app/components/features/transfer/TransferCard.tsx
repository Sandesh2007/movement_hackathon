"use client";

/**
 * TransferCard Component
 *
 * Displays transfer information and allows user to execute the transfer.
 * Uses server-side API route to handle Movement Network token transfers.
 *
 * Based on Privy Movement Network documentation:
 * https://docs.privy.io/recipes/use-tier-2#movement
 */

import React, { useState, useMemo } from "react";
import { usePrivy, WalletWithMetadata } from "@privy-io/react-auth";
import { TransferData } from "../../types";
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
import { toHex } from "viem"
import {useSignRawHash} from '@privy-io/react-auth/extended-chains';
import { debugPort } from "process";

interface TransferCardProps {
  data: TransferData;
  onTransferInitiate?: () => void;
}

// Movement Network configuration - Mainnet
const MOVEMENT_NETWORK = Network.TESTNET;
const MOVEMENT_FULLNODE = "https://full.testnet.movementinfra.xyz/v1";


const aptos = new Aptos(
  new AptosConfig({
    network: MOVEMENT_NETWORK,
    fullnode: MOVEMENT_FULLNODE
  })
);

export const TransferCard: React.FC<TransferCardProps> = ({
  data,
  onTransferInitiate,
}) => {
  
  const {signRawHash} = useSignRawHash();
  const { amount, token, tokenSymbol, toAddress, fromAddress, network, error } = data;
  const { user, ready, authenticated } = usePrivy();
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Get Movement wallet from user's linked accounts
  const movementWallet = useMemo(() => {
    if (!ready || !authenticated || !user?.linkedAccounts) {
      return null;
    }
    return user.linkedAccounts.find(
      (account): account is WalletWithMetadata =>
        account.type === "wallet" && account.chainType === "aptos"
    ) || null;
  }, [user, ready, authenticated]);

  const handleTransfer = async () => {
    if (!movementWallet) {
      setTransferError("Movement wallet not found. Please create a Movement wallet first.");
      return;
    }

    if (!ready || !authenticated) {
      setTransferError("Please authenticate first.");
      return;
    }

    setTransferring(true);
    setTransferError(null);
    setTxHash(null);

    try {
      // 2) Build the raw transaction (SDK fills in seq#, chainId, gas if you let it)

const aptosWallet = user?.linkedAccounts?.find(
  (a) => a.type === "wallet" && a.chainType === "aptos"
) as any;

debugger;

const senderAddress = aptosWallet.address as string;
const senderPubKeyWithScheme = aptosWallet.publicKey as string; // "004a4b8e35..."
const pubKeyNoScheme = senderPubKeyWithScheme.slice(2);           // drop leading "00"


const rawTxn = await aptos.transaction.build.simple({
  sender: senderAddress,
  data: {
    function: '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    functionArguments: ['0x31c8dbb5f226f6df7d276eec91de31cd3152a90ee2ca45767b5a7f5a62cdf25', 1] // amount in Octas
  }
});

const message = generateSigningMessageForTransaction(rawTxn);
const hash = toHex(message);
const signatureResponse = await signRawHash({
  address: senderAddress,
  chainType: 'aptos',
  hash: hash
});

const publicKey = new Ed25519PublicKey(`0x${pubKeyNoScheme}`);      // already 0x‑prefixed
const sig = new Ed25519Signature(signatureResponse.signature.slice(2));         // drop 0x from sig

const senderAuthenticator = new AccountAuthenticatorEd25519(publicKey, sig)

const pending = await aptos.transaction.submit.simple({
  transaction: rawTxn,
  senderAuthenticator
});

const executed = await aptos.waitForTransaction({
  transactionHash: pending.hash
});
console.log('Executed:', executed.hash);


    } catch (err: any) {
      debugger;
      console.error("Transfer error:", err);
      setTransferError(err.message || "Transfer failed. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 my-3 border-2 border-purple-200 shadow-elevation-md animate-fade-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <span className="text-2xl">💸</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transfer Tokens</h3>
          <p className="text-sm text-gray-600">Movement Network</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Amount:</span>
          <span className="text-sm font-semibold text-gray-900">
            {amount} {tokenSymbol || token}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">From:</span>
          <span className="text-sm text-gray-600 font-mono">
            {fromAddress.slice(0, 6)}...{fromAddress.slice(-4)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">To:</span>
          <span className="text-sm text-gray-600 font-mono">
            {toAddress.slice(0, 6)}...{toAddress.slice(-4)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Network:</span>
          <span className="text-sm text-gray-600">{network}</span>
        </div>
      </div>

      {txHash && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-800 mb-1">Transaction Hash:</p>
          <p className="text-xs font-mono text-green-900 break-all mb-2">{txHash}</p>
          <a
            href={`https://explorer.movementlabs.xyz/txn/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 hover:text-green-900 underline"
          >
            View on Movement Explorer →
          </a>
        </div>
      )}

      {transferError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{transferError}</p>
        </div>
      )}

      <button
        onClick={handleTransfer}
        disabled={transferring || !!txHash}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
          transferring || txHash
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
        }`}
      >
        {transferring
          ? "Transferring..."
          : txHash
          ? "Transfer Complete"
          : "Transfer"}
      </button>
    </div>
  );
};

