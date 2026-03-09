import { BigInt, ethereum, store } from "@graphprotocol/graph-ts";
import { UserBinLiquidity, LBPair, User } from "../../generated/schema";
import { BIG_INT_ZERO } from "../constants";
import { loadBin } from "./bin";

export function getUserBinLiquidity(
  liquidityPositionsId: string,
  lbPair: LBPair,
  user: User,
  binId: BigInt,
  block: ethereum.Block,
): UserBinLiquidity {
  const id = liquidityPositionsId.concat("-").concat(binId.toString());

  let userBinLiquidity = UserBinLiquidity.load(id);

  if (!userBinLiquidity) {
    userBinLiquidity = new UserBinLiquidity(id);
    const lbPairBin = loadBin(lbPair, binId.toU32());
    userBinLiquidity.lbPair = lbPair.id;
    userBinLiquidity.user = user.id;
    userBinLiquidity.binId = binId;
    userBinLiquidity.lbPairBinId = lbPairBin.id;
    userBinLiquidity.liquidityPosition = liquidityPositionsId;
    userBinLiquidity.liquidity = BIG_INT_ZERO;
    userBinLiquidity.save();
  }

  return userBinLiquidity as UserBinLiquidity;
}

export function removeUserBinLiquidity(id: string): void {
  store.remove("UserBinLiquidity", id);
}
