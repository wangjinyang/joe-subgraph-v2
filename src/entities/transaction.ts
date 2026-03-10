import { ethereum } from "@graphprotocol/graph-ts";
import { Transaction } from "../../generated/schema";

export function loadTransaction(event: ethereum.Event): Transaction {
  const transactionId =
    event.transaction.hash.toHexString() + "#" + event.logIndex.toString();
  let transaction = Transaction.load(transactionId);

  if (!transaction) {
    transaction = new Transaction(transactionId);
    transaction.blockNumber = event.block.number.toI32();
    transaction.timestamp = event.block.timestamp.toI32();

    transaction.save();
  }

  return transaction as Transaction;
}
