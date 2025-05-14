import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const txHash = "0x1ab090adb1fa3cc4571896f643f4f42655adf9263271a19ff00389659f50af7d";

async function main() {
  const receipt = await provider.getTransactionReceipt(txHash);
  const iface = new ethers.Interface([
    `event OrderFulfilled(
      bytes32 orderHash,
      address indexed offerer,
      address indexed zone,
      address recipient,
      tuple(
        uint8 itemType,
        address token,
        uint256 identifier,
        uint256 amount
      )[] offer,
      tuple(
        uint8 itemType,
        address token,
        uint256 identifier,
        uint256 amount,
        address recipient
      )[] consideration
    )`
  ]);

  for (const log of receipt!.logs) {
    try {
      const parsedLog = iface.parseLog(log);
      if (parsedLog!.name === "OrderFulfilled") {
        console.log("OrderFulfilled Event:");
        console.log(parsedLog!.args);
      }
    } catch (e) {
      // Ignore logs that don't match the event
    }
  }
}

main().catch(console.error);
