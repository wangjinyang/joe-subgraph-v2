import { Address, BigInt, ethereum, store } from "@graphprotocol/graph-ts";
import { UserBinLiquidity, LBPair, User } from "../../generated/schema";
import { BIG_INT_ZERO } from "../constants";
// import { loadBin } from "./bin";

export function getUserBinLiquidityID(
  liquidityPositionsId: string,
  binId: BigInt
): string {
  return liquidityPositionsId.concat("-").concat(binId.toString());
}

export function getUserBinLiquidity(
  lbPair: LBPair,
  liquidityPositionsId: string,
  user: Address,
  binId: BigInt,
): UserBinLiquidity {
  const id = getUserBinLiquidityID(liquidityPositionsId, binId);

  let userBinLiquidity = UserBinLiquidity.load(id);

  if (!userBinLiquidity) {
    userBinLiquidity = new UserBinLiquidity(id);
    // const lbPairBin = loadBin(lbPair, binId);
    userBinLiquidity.lbPair = lbPair.id;
    userBinLiquidity.user = user.toHexString();
    userBinLiquidity.binId = binId;
    // userBinLiquidity.lbPairBinId = lbPairBin.id;
    userBinLiquidity.liquidityPosition = liquidityPositionsId;
    userBinLiquidity.liquidity = BIG_INT_ZERO;
  }

  return userBinLiquidity;
}

export function removeUserBinLiquidity(id: string): void {
  store.remove("UserBinLiquidity", id);
}
