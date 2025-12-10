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

interface TransferCardProps {
  data: TransferData;
  onTransferInitiate?: () => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({
  data,
  onTransferInitiate,
}) => {
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
      // Validate inputs
      if (!toAddress || !toAddress.startsWith("0x")) {
        throw new Error("Invalid recipient address");
      }

      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        throw new Error("Invalid transfer amount");
      }

      // Get wallet ID from Privy wallet
      // For Movement/Aptos wallets, we need the actual Privy wallet ID, not the address
      // The wallet ID is typically in the 'walletClientId' field for extended chain wallets
      const walletId = 
        (movementWallet as any).walletClientId || 
        (movementWallet as any).walletId ||
        (movementWallet as any).id || 
        movementWallet.address;
      
      console.log("Wallet ID for transfer:", {
        walletClientId: (movementWallet as any).walletClientId,
        walletId: (movementWallet as any).walletId,
        id: (movementWallet as any).id,
        address: movementWallet.address,
        using: walletId,
      });

      // Call server-side transfer API route
      const transferResponse = await fetch("/api/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletId,
          fromAddress,
          toAddress,
          amount: transferAmount.toString(),
          token: token || tokenSymbol,
          tokenSymbol: tokenSymbol || token,
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json();
        throw new Error(errorData.error || "Transfer failed");
      }

      const result = await transferResponse.json();

      if (!result.success) {
        throw new Error(result.error || "Transfer failed");
      }

      setTxHash(result.transactionHash);
      onTransferInitiate?.();
    } catch (err: any) {
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

