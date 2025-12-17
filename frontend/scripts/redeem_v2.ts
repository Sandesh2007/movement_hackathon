import * as aptos from "aptos";
import * as superSDK from "../lib/super-aptos-sdk/src";
import * as superJsonApiClient from "../lib/super-json-api-client/src";
import {
  getWalletAccount,
  getBrokerName,
  getPortfolioState,
  getCoinType,
  getCoinDecimals,
  getBrokerAddress,
  convertAmountToRaw,
  signSubmitWait,
  MOVEPOSITION_ADDRESS,
  RPC_URL,
  API_BASE,
} from "./shared";

async function main() {
  const amount = process.argv[2] || "1000";
  const coinSymbol = process.argv[3] || "APT";

  console.log(
    `Executing redeem_v2 with amount: ${amount}, coin: ${coinSymbol}`
  );

  const walletAccount = getWalletAccount();
  const coinType = getCoinType(coinSymbol);
  const coinDecimals = getCoinDecimals(coinSymbol);
  const rawAmount = convertAmountToRaw(amount, coinDecimals);
  const brokerAddress = getBrokerAddress(coinType);

  console.log(
    `Converted amount: ${amount} -> ${rawAmount} (decimals: ${coinDecimals})`
  );

  const aptosClient = new aptos.AptosClient(RPC_URL);
  const sdk = new superSDK.SuperpositionAptosSDK(MOVEPOSITION_ADDRESS);
  const superClient = new superJsonApiClient.SuperClient({
    BASE: API_BASE,
  });

  const brokerName = await getBrokerName(superClient, brokerAddress);
  const currentPortfolioState = await getPortfolioState(
    superClient,
    walletAccount.address().hex()
  );

  const signerPubkey = walletAccount.address().hex();
  const network = "aptos";

  console.log("Requesting redeem ticket...");
  const redeemTicket = await superClient.default.redeemV2({
    amount: rawAmount,
    signerPubkey,
    network,
    brokerName,
    currentPortfolioState,
  });

  console.log("Decoding and submitting transaction...");
  const ticketString = new aptos.HexString(redeemTicket.packet);
  const ticketUintArray = ticketString.toUint8Array();
  const redeemIX = sdk.redeemV2Ix(ticketUintArray, coinType);
  await signSubmitWait(aptosClient, walletAccount, redeemIX);

  console.log("Redeem_v2 transaction completed successfully!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
