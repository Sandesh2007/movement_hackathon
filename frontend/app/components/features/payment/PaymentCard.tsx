"use client";

/**
 * PaymentCard Component
 *
 * Displays payment information and allows user to execute payment.
 * Used when a 402 Payment Required error is encountered.
 */

import React, { useState, useMemo } from "react";
import { usePrivy, WalletWithMetadata } from "@privy-io/react-auth";
import { PaymentData } from "../../types";
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
  ChainId,
} from "@aptos-labs/ts-sdk";
import { toHex } from "viem";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";

interface PaymentCardProps {
  data: PaymentData;
  onPaymentComplete?: (txHash: string) => void;
}

// Movement Network configuration - Mainnet
const MOVEMENT_NETWORK = Network.MAINNET;
const MOVEMENT_FULLNODE = "https://full.mainnet.movementinfra.xyz/v1";
const MOVEMENT_CHAIN_ID = 126; // Mainnet chain ID

const aptos = new Aptos(
  new AptosConfig({
    network: MOVEMENT_NETWORK,
    fullnode: MOVEMENT_FULLNODE,
  })
);

export const PaymentCard: React.FC<PaymentCardProps> = ({
  data,
  onPaymentComplete,
}) => {
  const { signRawHash } = useSignRawHash();
  const { amount, token, tokenSymbol, recipientAddress, description, error } =
    data;
  const { user, ready, authenticated } = usePrivy();
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(error || null);
  const [txHash, setTxHash] = useState<string | null>(data.transactionHash || null);

  // Get Movement wallet from user's linked accounts
  const movementWallet = useMemo(() => {
    if (!ready || !authenticated || !user?.linkedAccounts) {
      return null;
    }
    return (
      user.linkedAccounts.find(
        (account): account is WalletWithMetadata =>
          account.type === "wallet" && account.chainType === "aptos"
      ) || null
    );
  }, [user, ready, authenticated]);

  const handlePayment = async () => {
    if (!movementWallet) {
      setPaymentError(
        "Movement wallet not found. Please create a Movement wallet first."
      );
      return;
    }

    if (!ready || !authenticated) {
      setPaymentError("Please authenticate first.");
      return;
    }

    if (!recipientAddress) {
      setPaymentError("Recipient address is required.");
      return;
    }

    setPaying(true);
    setPaymentError(null);
    setTxHash(null);

    try {
      // Get Aptos wallet from user's linked accounts
      const aptosWallet = user?.linkedAccounts?.find(
        (a) => a.type === "wallet" && a.chainType === "aptos"
      ) as any;

      if (!aptosWallet) {
        throw new Error("Aptos wallet not found");
      }

      const senderAddress = aptosWallet.address as string;
      const senderPubKeyWithScheme = aptosWallet.publicKey as string;

      if (!senderPubKeyWithScheme || senderPubKeyWithScheme.length < 2) {
        throw new Error("Invalid public key format");
      }

      const pubKeyNoScheme = senderPubKeyWithScheme.slice(2); // drop leading "00"

      // Validate recipient address
      if (
        !recipientAddress ||
        !recipientAddress.startsWith("0x") ||
        recipientAddress.length !== 66
      ) {
        throw new Error(
          "Invalid recipient address. Must be 66 characters and start with 0x."
        );
      }

      // Convert amount to Octas (Aptos uses 8 decimals)
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Invalid amount. Please enter a positive number.");
      }
      const amountInOctas = Math.floor(parsedAmount * 100000000);

      // Build the raw transaction
      const rawTxn = await aptos.transaction.build.simple({
        sender: senderAddress,
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [recipientAddress, amountInOctas],
        },
      });

      // Override chain ID to match Movement Network mainnet
      const txnObj = rawTxn as any;
      if (txnObj.rawTransaction) {
        const movementChainId = new ChainId(MOVEMENT_CHAIN_ID);
        txnObj.rawTransaction.chain_id = movementChainId;
      }

      // Generate signing message and hash
      const message = generateSigningMessageForTransaction(rawTxn);
      const hash = toHex(message);

      // Sign the hash using Privy's signRawHash
      const signatureResponse = await signRawHash({
        address: senderAddress,
        chainType: "aptos",
        hash: hash,
      });

      // Create authenticator from signature
      const publicKey = new Ed25519PublicKey(`0x${pubKeyNoScheme}`);
      const sig = new Ed25519Signature(signatureResponse.signature.slice(2)); // drop 0x from sig
      const senderAuthenticator = new AccountAuthenticatorEd25519(
        publicKey,
        sig
      );

      // Submit transaction
      const pending = await aptos.transaction.submit.simple({
        transaction: rawTxn,
        senderAuthenticator,
      });

      // Wait for transaction to be executed
      const executed = await aptos.waitForTransaction({
        transactionHash: pending.hash,
      });

      console.log("Payment transaction executed:", executed.hash);
      setTxHash(executed.hash);
      onPaymentComplete?.(executed.hash);
    } catch (err: any) {
      console.error("Payment error:", err);
      setPaymentError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const DetailRow = ({
    label,
    value,
    mono,
  }: {
    label: string;
    value: string;
    mono?: boolean;
  }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono" : ""} ${
          mono ? "text-gray-900" : "text-gray-700"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 my-4 max-w-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Payment Required
        </h3>
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <DetailRow label="Amount" value={`${amount} ${tokenSymbol}`} />
        {recipientAddress && (
          <DetailRow
            label="Recipient"
            value={`${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`}
            mono
          />
        )}
        {token && <DetailRow label="Token" value={tokenSymbol} />}
      </div>

      {paymentError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{paymentError}</p>
        </div>
      )}

      {txHash && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium mb-1">
            Payment Successful!
          </p>
          <p className="text-xs text-green-600 font-mono break-all">
            {txHash}
          </p>
        </div>
      )}

      {!txHash && (
        <button
          onClick={handlePayment}
          disabled={paying || !movementWallet || !recipientAddress}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {paying ? "Processing Payment..." : "Pay Now"}
        </button>
      )}
    </div>
  );
};

