import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { LiquidityPosition, LBPair, User } from "../../generated/schema";
import { BIG_INT_ZERO, BIG_INT_ONE, ADDRESS_ZERO } from "../constants";
import { getUserBinLiquidity } from "./userBinLiquidity";

function getLiquidityPosition(
  lbPair: LBPair,
  user: Address,
): LiquidityPosition {
  const id = lbPair.id.concat("-").concat(user.toHexString());

  let liquidityPosition = LiquidityPosition.load(id);

  if (!liquidityPosition) {
    liquidityPosition = new LiquidityPosition(id);
    liquidityPosition.user = user.toHexString();
    liquidityPosition.lbPair = lbPair.id;
    liquidityPosition.binsCount = BIG_INT_ZERO;
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

  let liquidityPosition = getLiquidityPosition(lbPair, userAddr);
  let userBinLiquidity = getUserBinLiquidity(
    lbPair,
    liquidityPosition.id,
    userAddr,
    binId,
  );

  if (userBinLiquidity.liquidity.equals(BIG_INT_ZERO)) {
    // increase count of bins user has liquidity
    liquidityPosition.binsCount = liquidityPosition.binsCount.plus(BIG_INT_ONE);
    liquidityPosition.save();
  }

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

  let liquidityPosition = getLiquidityPosition(lbPair, userAddr);
  let userBinLiquidity = getUserBinLiquidity(
    lbPair,
    liquidityPosition.id,
    userAddr,
    binId,
  );

  // update liquidity
  userBinLiquidity.liquidity = userBinLiquidity.liquidity.minus(liquidity);

  if (userBinLiquidity.liquidity.le(BIG_INT_ZERO)) {
    userBinLiquidity.liquidity = BIG_INT_ZERO;
    // decrease count of bins with user's liquidityPosition
    liquidityPosition.binsCount =
      liquidityPosition.binsCount.minus(BIG_INT_ONE);
    liquidityPosition.save();
  }

  userBinLiquidity.save();
}
