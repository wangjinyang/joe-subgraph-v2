import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { LiquidityPosition, LBPair, User } from "../../generated/schema";
import { BIG_INT_ZERO, BIG_INT_ONE, ADDRESS_ZERO } from "../constants";
import {
  getUserBinLiquidity,
  removeUserBinLiquidity,
} from "./userBinLiquidity";

function getLiquidityPositionId(lbPair: LBPair, user: Address): string {
  return lbPair.id.concat("-").concat(user.toHexString());
}

function getLiquidityPosition(
  lbPair: LBPair,
  user: Address,
): LiquidityPosition {
  const id = getLiquidityPositionId(lbPair, user);

  let liquidityPosition = LiquidityPosition.load(id);

  if (!liquidityPosition) {
    liquidityPosition = new LiquidityPosition(id);
    liquidityPosition.user = user.toHexString();
    liquidityPosition.lbPair = lbPair.id;
    // liquidityPosition.binsCount = BIG_INT_ZERO;
    liquidityPosition.save();
  }

  return liquidityPosition as LiquidityPosition;
}

export function addLiquidityPosition(
  lbPair: LBPair,
  userAddr: Address,
  binId: BigInt,
  liquidity: BigInt,
): void {
  // skip if 'userAddr' is zero address (mint transaction)
  if (userAddr.equals(ADDRESS_ZERO)) {
    return;
  }

  // skip if 'userAddr' is an LBPair address
  const tryLBPair = LBPair.load(userAddr.toHexString());
  if (tryLBPair) {
    return;
  }

  const liquidityPositionId = getLiquidityPositionId(lbPair, userAddr);

  if (LiquidityPosition.load(liquidityPositionId) == null) {
    const liquidityPosition = new LiquidityPosition(liquidityPositionId);
    liquidityPosition.user = userAddr.toHexString();
    liquidityPosition.lbPair = lbPair.id;
    // liquidityPosition.binsCount = BIG_INT_ZERO;
    liquidityPosition.save();
  }

  let userBinLiquidity = getUserBinLiquidity(
    lbPair,
    liquidityPositionId,
    userAddr,
    binId,
  );

  // if (userBinLiquidity.liquidity.equals(BIG_INT_ZERO)) {
  //   // increase count of bins user has liquidity
  //   liquidityPosition.binsCount = liquidityPosition.binsCount.plus(BIG_INT_ONE);
  //   liquidityPosition.save();
  // }

  // update liquidity
  userBinLiquidity.liquidity = userBinLiquidity.liquidity.plus(liquidity);
  userBinLiquidity.save();
}

export function removeLiquidityPosition(
  lbPair: LBPair,
  userAddr: Address,
  binId: BigInt,
  liquidity: BigInt,
): void {
  // skip if 'userAddr' is zero address (burn transaction)
  if (userAddr.equals(ADDRESS_ZERO)) {
    return;
  }

  // skip if 'userAddr' is an LBPair address
  const tryLBPair = LBPair.load(userAddr.toHexString());
  if (tryLBPair) {
    return;
  }

  // let liquidityPosition = getLiquidityPosition(lbPair, userAddr);
  let userBinLiquidity = getUserBinLiquidity(
    lbPair,
    getLiquidityPositionId(lbPair, userAddr),
    userAddr,
    binId,
  );

  // update liquidity
  userBinLiquidity.liquidity = userBinLiquidity.liquidity.minus(liquidity);

  if (userBinLiquidity.liquidity.le(BIG_INT_ZERO)) {
    // decrease count of bins with user's liquidityPosition
    // liquidityPosition.binsCount =
    //   liquidityPosition.binsCount.minus(BIG_INT_ONE);
    // liquidityPosition.save();
    removeUserBinLiquidity(userBinLiquidity.id);
    return;
  }

  userBinLiquidity.save();
}
