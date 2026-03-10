// Tick field is yet to be added

import { Address, BigDecimal, log, BigInt } from "@graphprotocol/graph-ts";
import {
  Swap as SwapEvent,
  FlashLoan,
  DepositedToBins,
  CompositionFees,
  WithdrawnFromBins,
  CollectedProtocolFees,
  TransferBatch,
} from "../generated/LBPair/LBPair";
import {
  Token,
  LBPair,
  Swap,
  Flash,
  Collect,
  Transfer,
  LBPairParameterSet,
} from "../generated/schema";
import {
  loadBin,
  loadLbPair,
  loadToken,
  loadBundle,
  loadLBFactory,
  loadTraderJoeDayData,
  loadSJoeDayData,
  loadUser,
  loadLBPairDayData,
  loadLBPairHourData,
  addLiquidityPosition,
  removeLiquidityPosition,
  loadTransaction,
  trackBin,
} from "./entities";
import {
  BIG_INT_ONE,
  BIG_DECIMAL_ZERO,
  BIG_INT_ZERO,
  ADDRESS_ZERO,
} from "./constants";
import {
  formatTokenAmountByDecimals,
  getTrackedLiquidityUSD,
  getTrackedVolumeUSD,
  updateAvaxInUsdPricing,
  updateTokensDerivedAvax,
  safeDiv,
  decodeAmounts,
} from "./utils";
import { StaticFeeParametersSet } from "../generated/LBFactory/LBPair";

export function handleSwap(event: SwapEvent): void {
  const lbPair = loadLbPair(event.address);

  if (!lbPair) {
    log.warning("[handleSwap] LBPair not detected: {} ", [
      event.address.toHexString(),
    ]);
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  // reset tvl aggregates until new amounts calculated
  const lbFactory = loadLBFactory();
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.minus(
    lbPair.totalValueLockedAVAX,
  );

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));
  const tokenXPriceUSD = tokenX.derivedAVAX.times(bundle.avaxPriceUSD);
  const tokenYPriceUSD = tokenY.derivedAVAX.times(bundle.avaxPriceUSD);

  // const swapForY = event.params.swapForY;
  const tokenIn = tokenX;
  const tokenOut = tokenY;

  const amountsIn = decodeAmounts(event.params.amountsIn);
  const amountXIn = amountsIn[0];
  const amountYIn = amountsIn[1];

  const fmtAmountXIn = formatTokenAmountByDecimals(amountXIn, tokenIn.decimals);
  const fmtAmountYIn = formatTokenAmountByDecimals(
    amountYIn,
    tokenOut.decimals,
  );

  const amountsOut = decodeAmounts(event.params.amountsOut);
  const amountXOut = amountsOut[0];
  const amountYOut = amountsOut[1];

  const fmtAmountXOut = formatTokenAmountByDecimals(
    amountXOut,
    tokenIn.decimals,
  );
  const fmtAmountYOut = formatTokenAmountByDecimals(
    amountYOut,
    tokenOut.decimals,
  );

  const totalFees = decodeAmounts(event.params.totalFees);
  const totalFeesX = formatTokenAmountByDecimals(
    totalFees[0],
    tokenIn.decimals,
  );
  const totalFeesY = formatTokenAmountByDecimals(
    totalFees[1],
    tokenOut.decimals,
  );
  const feesUSD = totalFeesX
    .times(tokenIn.derivedAVAX.times(bundle.avaxPriceUSD))
    .plus(totalFeesY.times(tokenY.derivedAVAX.times(bundle.avaxPriceUSD)));

  const amountXTotal = fmtAmountXIn.plus(fmtAmountXOut);
  const amountYTotal = fmtAmountYIn.plus(fmtAmountYOut);

  const trackedVolumeUSD = getTrackedVolumeUSD(
    amountXTotal,
    tokenX as Token,
    amountYTotal,
    tokenY as Token,
  );
  const trackedVolumeAVAX = safeDiv(trackedVolumeUSD, bundle.avaxPriceUSD);

  // Bin
  const bin = trackBin(
    lbPair as LBPair,
    event.params.id,
    fmtAmountXIn,
    fmtAmountXOut,
    fmtAmountYIn,
    fmtAmountYOut,
    BIG_INT_ZERO,
    BIG_INT_ZERO,
  );

  // LBPair
  lbPair.activeId = event.params.id;
  lbPair.reserveX = lbPair.reserveX.plus(fmtAmountXIn).minus(fmtAmountXOut);
  lbPair.reserveY = lbPair.reserveY.plus(fmtAmountYIn).minus(fmtAmountYOut);
  lbPair.totalValueLockedUSD = getTrackedLiquidityUSD(
    lbPair.reserveX,
    tokenX as Token,
    lbPair.reserveY,
    tokenY as Token,
  );
  lbPair.totalValueLockedAVAX = safeDiv(
    lbPair.totalValueLockedUSD,
    bundle.avaxPriceUSD,
  );
  lbPair.tokenXPrice = bin.priceX;
  lbPair.tokenYPrice = bin.priceY;
  lbPair.volumeTokenX = lbPair.volumeTokenX.plus(amountXTotal);
  lbPair.volumeTokenY = lbPair.volumeTokenY.plus(amountYTotal);
  lbPair.volumeUSD = lbPair.volumeUSD.plus(trackedVolumeUSD);
  lbPair.feesTokenX = lbPair.feesTokenX.plus(totalFeesX);
  lbPair.feesTokenY = lbPair.feesTokenY.plus(totalFeesY);
  lbPair.feesUSD = lbPair.feesUSD.plus(feesUSD);
  lbPair.save();

  // LBPairHourData
  const lbPairHourData = loadLBPairHourData(
    event.block.timestamp,
    lbPair as LBPair,
    true,
  );
  lbPairHourData.volumeTokenX = lbPairHourData.volumeTokenX.plus(amountXTotal);
  lbPairHourData.volumeTokenY = lbPairHourData.volumeTokenY.plus(amountYTotal);
  lbPairHourData.volumeUSD = lbPairHourData.volumeUSD.plus(trackedVolumeUSD);
  lbPairHourData.feesUSD = lbPairHourData.feesUSD.plus(feesUSD);
  lbPairHourData.save();

  // LBPairDayData
  const lbPairDayData = loadLBPairDayData(
    event.block.timestamp,
    lbPair as LBPair,
    true,
  );
  lbPairDayData.volumeTokenX = lbPairDayData.volumeTokenX.plus(amountXTotal);
  lbPairDayData.volumeTokenY = lbPairDayData.volumeTokenY.plus(amountYTotal);
  lbPairDayData.volumeUSD = lbPairDayData.volumeUSD.plus(trackedVolumeUSD);
  lbPairDayData.feesUSD = lbPairDayData.feesUSD.plus(feesUSD);
  lbPairDayData.save();

  // LBFactory
  lbFactory.volumeUSD = lbFactory.volumeUSD.plus(trackedVolumeUSD);
  lbFactory.volumeAVAX = lbFactory.volumeAVAX.plus(trackedVolumeAVAX);
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.plus(
    lbPair.totalValueLockedAVAX,
  );
  lbFactory.totalValueLockedUSD = lbFactory.totalValueLockedAVAX.times(
    bundle.avaxPriceUSD,
  );
  lbFactory.feesUSD = lbFactory.feesUSD.plus(feesUSD);
  lbFactory.feesAVAX = safeDiv(lbFactory.feesUSD, bundle.avaxPriceUSD);
  lbFactory.save();

  // TraderJoeDayData
  const traderJoeDayData = loadTraderJoeDayData(event.block.timestamp, true);
  traderJoeDayData.volumeAVAX =
    traderJoeDayData.volumeAVAX.plus(trackedVolumeAVAX);
  traderJoeDayData.volumeUSD =
    traderJoeDayData.volumeUSD.plus(trackedVolumeUSD);
  traderJoeDayData.feesUSD = traderJoeDayData.feesUSD.plus(feesUSD);
  traderJoeDayData.save();

  // TokenX
  tokenX.volume = tokenX.volume.plus(amountXTotal);
  tokenX.volumeUSD = tokenX.volumeUSD.plus(trackedVolumeUSD);
  tokenX.totalValueLocked = tokenX.totalValueLocked
    .plus(fmtAmountXIn)
    .minus(fmtAmountXOut);
  tokenX.totalValueLockedUSD = tokenX.totalValueLockedUSD.plus(
    tokenX.totalValueLocked.times(tokenXPriceUSD),
  );
  const feesUsdX = totalFeesX.times(
    tokenIn.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenX.feesUSD = tokenX.feesUSD.plus(feesUsdX);

  // TokenY
  tokenY.volume = tokenY.volume.plus(amountYTotal);
  tokenY.volumeUSD = tokenY.volumeUSD.plus(trackedVolumeUSD);
  tokenY.totalValueLocked = tokenY.totalValueLocked
    .plus(fmtAmountYIn)
    .minus(fmtAmountYOut);
  tokenY.totalValueLockedUSD = tokenY.totalValueLockedUSD.plus(
    tokenY.totalValueLocked.times(tokenYPriceUSD),
  );
  const feesUsdY = totalFeesY.times(
    tokenY.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenY.feesUSD = tokenY.feesUSD.plus(feesUsdY);

  tokenX.save();
  tokenY.save();

  // User
  loadUser(event.params.to);

  // Transaction
  const transaction = loadTransaction(event);

  // Swap
  const swap = new Swap(
    transaction.id.concat("#").concat(event.logIndex.toString()),
  );
  swap.transaction = transaction.id;
  swap.timestamp = event.block.timestamp.toI32();
  swap.lbPair = lbPair.id;
  swap.sender = event.params.sender;
  swap.recipient = event.params.to;
  swap.origin = event.transaction.from;
  swap.activeId = event.params.id;
  swap.amountXIn = fmtAmountXIn;
  swap.amountXOut = fmtAmountXOut;
  swap.amountYIn = fmtAmountYIn;
  swap.amountYOut = fmtAmountYOut;
  swap.amountUSD = trackedVolumeUSD;
  swap.feesTokenX = totalFeesX;
  swap.feesTokenY = totalFeesY;
  swap.feesUSD = feesUSD;
  swap.logIndex = event.logIndex;
  swap.save();
}

export function handleFlashLoan(event: FlashLoan): void {
  const lbPair = loadLbPair(event.address);

  if (!lbPair) {
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));

  const amounts = decodeAmounts(event.params.amounts);
  const amountX = formatTokenAmountByDecimals(amounts[0], tokenX.decimals);
  const amountY = formatTokenAmountByDecimals(amounts[1], tokenY.decimals);

  const totalFees = decodeAmounts(event.params.totalFees);
  const feesX = formatTokenAmountByDecimals(totalFees[0], tokenX.decimals);
  const feesY = formatTokenAmountByDecimals(totalFees[1], tokenY.decimals);
  const feesUSD = feesX
    .times(tokenX.derivedAVAX.times(bundle.avaxPriceUSD))
    .plus(feesY.times(tokenY.derivedAVAX.times(bundle.avaxPriceUSD)));

  const lbFactory = loadLBFactory();
  lbFactory.feesUSD = lbFactory.feesUSD.plus(feesUSD);
  lbFactory.feesAVAX = safeDiv(lbFactory.feesUSD, bundle.avaxPriceUSD);
  lbFactory.save();

  const traderJoeDayData = loadTraderJoeDayData(event.block.timestamp, true);
  traderJoeDayData.feesUSD = traderJoeDayData.feesUSD.plus(feesUSD);
  traderJoeDayData.save();

  const tokens = [tokenX, tokenY];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    token.feesUSD = token.feesUSD.plus(feesUSD);
    token.save();
  }

  lbPair.feesTokenX = lbPair.feesTokenX.plus(feesX);
  lbPair.feesTokenY = lbPair.feesTokenY.plus(feesY);
  lbPair.feesUSD = lbPair.feesUSD.plus(feesUSD);
  lbPair.save();

  const lbPairHourData = loadLBPairHourData(
    event.block.timestamp,
    lbPair as LBPair,
    true,
  );
  lbPairHourData.feesUSD = lbPairHourData.feesUSD.plus(feesUSD);
  lbPairHourData.save();

  const lbPairDayData = loadLBPairDayData(
    event.block.timestamp,
    lbPair as LBPair,
    true,
  );
  lbPairDayData.feesUSD = lbPairDayData.feesUSD.plus(feesUSD);
  lbPairDayData.save();

  const transaction = loadTransaction(event);

  const flashloan = new Flash(
    transaction.id.concat("#").concat(event.logIndex.toString()),
  );
  flashloan.transaction = transaction.id;
  flashloan.timestamp = event.block.timestamp.toI32();
  flashloan.lbPair = lbPair.id;
  flashloan.sender = event.params.sender;
  flashloan.recipient = event.params.receiver;
  flashloan.origin = event.transaction.from;
  flashloan.amountX = amountX;
  flashloan.amountY = amountY;
  flashloan.amountUSD = amountX
    .times(tokenX.derivedAVAX.times(bundle.avaxPriceUSD))
    .plus(amountY.times(tokenY.derivedAVAX.times(bundle.avaxPriceUSD)));
  flashloan.feesX = feesX;
  flashloan.feesY = feesY;
  flashloan.feesUSD = feesUSD;
  flashloan.logIndex = event.logIndex;
  flashloan.save();
}

export function handleCompositionFee(event: CompositionFees): void {
  const lbPair = loadLbPair(event.address);

  if (!lbPair) {
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));
  const tokenXPriceUSD = tokenX.derivedAVAX.times(bundle.avaxPriceUSD);
  const tokenYPriceUSD = tokenY.derivedAVAX.times(bundle.avaxPriceUSD);

  const fees = decodeAmounts(event.params.totalFees);
  const feesX = formatTokenAmountByDecimals(fees[0], tokenX.decimals);
  const feesY = formatTokenAmountByDecimals(fees[1], tokenY.decimals);
  const feesUSD = feesX
    .times(tokenX.derivedAVAX.times(bundle.avaxPriceUSD))
    .plus(feesY.times(tokenY.derivedAVAX.times(bundle.avaxPriceUSD)));

  const lbFactory = loadLBFactory();
  lbFactory.feesUSD = lbFactory.feesUSD.plus(feesUSD);
  lbFactory.feesAVAX = safeDiv(lbFactory.feesUSD, bundle.avaxPriceUSD);
  lbFactory.save();

  const traderJoeDayData = loadTraderJoeDayData(event.block.timestamp, false);
  traderJoeDayData.feesUSD = traderJoeDayData.feesUSD.plus(feesUSD);
  traderJoeDayData.save();

  tokenX.feesUSD = tokenX.feesUSD.plus(feesX.times(tokenXPriceUSD));
  tokenX.save();

  tokenY.feesUSD = tokenY.feesUSD.plus(feesY.times(tokenYPriceUSD));
  tokenY.save();

  lbPair.feesTokenX = lbPair.feesTokenX.plus(feesX);
  lbPair.feesTokenY = lbPair.feesTokenY.plus(feesY);
  lbPair.feesUSD = lbPair.feesUSD.plus(feesUSD);
  lbPair.save();

  const lbPairHourData = loadLBPairHourData(
    event.block.timestamp,
    lbPair as LBPair,
    false,
  );
  lbPairHourData.feesUSD = lbPairHourData.feesUSD.plus(feesUSD);
  lbPairHourData.save();

  const lbPairDayData = loadLBPairDayData(
    event.block.timestamp,
    lbPair as LBPair,
    false,
  );
  lbPairDayData.feesUSD = lbPairDayData.feesUSD.plus(feesUSD);
  lbPairDayData.save();
}

export function handleLiquidityAdded(event: DepositedToBins): void {
  const lbPair = loadLbPair(event.address);
  const lbFactory = loadLBFactory();

  if (!lbPair) {
    log.error(
      "[handleLiquidityAdded] returning because LBPair not detected: {} ",
      [event.address.toHexString()],
    );
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));

  // total amounts
  let totalAmountX = BIG_DECIMAL_ZERO;
  let totalAmountY = BIG_DECIMAL_ZERO;

  for (let i = 0; i < event.params.ids.length; i++) {
    const bidId = event.params.ids[i];

    const amounts = decodeAmounts(event.params.amounts[i]);
    const amountX = formatTokenAmountByDecimals(amounts[0], tokenX.decimals);
    const amountY = formatTokenAmountByDecimals(amounts[1], tokenY.decimals);

    totalAmountX = totalAmountX.plus(amountX);
    totalAmountY = totalAmountY.plus(amountY);

    trackBin(
      lbPair,
      bidId.toI32(),
      amountX, // amountXIn
      BIG_DECIMAL_ZERO,
      amountY, // amountYIn
      BIG_DECIMAL_ZERO,
      BIG_INT_ZERO,
      BIG_INT_ZERO,
    );
  }

  // reset tvl aggregates until new amounts calculated
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.minus(
    lbPair.totalValueLockedAVAX,
  );

  // LBPair
  lbPair.reserveX = lbPair.reserveX.plus(totalAmountX);
  lbPair.reserveY = lbPair.reserveY.plus(totalAmountY);

  lbPair.totalValueLockedAVAX = lbPair.reserveX
    .times(tokenX.derivedAVAX)
    .plus(lbPair.reserveY.times(tokenY.derivedAVAX));
  lbPair.totalValueLockedUSD = lbPair.totalValueLockedAVAX.times(
    bundle.avaxPriceUSD,
  );

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityAVAX: BigDecimal;
  if (bundle.avaxPriceUSD.notEqual(BIG_DECIMAL_ZERO)) {
    trackedLiquidityAVAX = safeDiv(
      getTrackedLiquidityUSD(
        lbPair.reserveX,
        tokenX as Token,
        lbPair.reserveY,
        tokenY as Token,
      ),
      bundle.avaxPriceUSD,
    );
  } else {
    trackedLiquidityAVAX = BIG_DECIMAL_ZERO;
  }
  lbPair.save();

  // LBFactory
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.plus(
    lbPair.totalValueLockedAVAX,
  );
  lbFactory.totalValueLockedUSD = lbFactory.totalValueLockedAVAX.times(
    bundle.avaxPriceUSD,
  );
  lbFactory.save();

  loadLBPairHourData(event.block.timestamp, lbPair as LBPair, true);
  loadLBPairDayData(event.block.timestamp, lbPair as LBPair, true);
  loadTraderJoeDayData(event.block.timestamp, true);

  // TokenX
  tokenX.totalValueLocked = tokenX.totalValueLocked.plus(totalAmountX);
  tokenX.totalValueLockedUSD = tokenX.totalValueLocked.times(
    tokenX.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenX.save();

  // TokenY
  tokenY.totalValueLocked = tokenY.totalValueLocked.plus(totalAmountY);
  tokenY.totalValueLockedUSD = tokenY.totalValueLocked.times(
    tokenY.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenY.save();

  // User
  loadUser(event.params.to);
}

export function handleLiquidityRemoved(event: WithdrawnFromBins): void {
  const lbPair = loadLbPair(event.address);
  const lbFactory = loadLBFactory();

  if (!lbPair) {
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));

  // total amounts
  let totalAmountX = BIG_DECIMAL_ZERO;
  let totalAmountY = BIG_DECIMAL_ZERO;

  // track bins
  for (let i = 0; i < event.params.amounts.length; i++) {
    const val = event.params.amounts[i];
    const amounts = decodeAmounts(val);
    const fmtAmountX = formatTokenAmountByDecimals(amounts[0], tokenX.decimals);
    const fmtAmountY = formatTokenAmountByDecimals(amounts[1], tokenY.decimals);

    totalAmountX = totalAmountX.plus(fmtAmountX);
    totalAmountY = totalAmountY.plus(fmtAmountY);

    trackBin(
      lbPair,
      event.params.ids[i].toU32(),
      BIG_DECIMAL_ZERO,
      fmtAmountX, // amountXOut
      BIG_DECIMAL_ZERO,
      fmtAmountY, // amountYOut
      BIG_INT_ZERO,
      BIG_INT_ZERO,
    );
  }

  // reset tvl aggregates until new amounts calculated
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.minus(
    lbPair.totalValueLockedAVAX,
  );

  // LBPair
  lbPair.reserveX = lbPair.reserveX.minus(totalAmountX);
  lbPair.reserveY = lbPair.reserveY.minus(totalAmountY);

  lbPair.totalValueLockedAVAX = lbPair.reserveX
    .times(tokenX.derivedAVAX)
    .plus(lbPair.reserveY.times(tokenY.derivedAVAX));
  lbPair.totalValueLockedUSD = lbPair.totalValueLockedAVAX.times(
    bundle.avaxPriceUSD,
  );

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityAVAX: BigDecimal;
  if (bundle.avaxPriceUSD.notEqual(BIG_DECIMAL_ZERO)) {
    trackedLiquidityAVAX = safeDiv(
      getTrackedLiquidityUSD(
        lbPair.reserveX,
        tokenX as Token,
        lbPair.reserveY,
        tokenY as Token,
      ),
      bundle.avaxPriceUSD,
    );
  } else {
    trackedLiquidityAVAX = BIG_DECIMAL_ZERO;
  }
  lbPair.save();

  // LBFactory
  lbFactory.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX.plus(
    lbPair.totalValueLockedAVAX,
  );
  lbFactory.totalValueLockedUSD = lbFactory.totalValueLockedAVAX.times(
    bundle.avaxPriceUSD,
  );
  lbFactory.save();

  loadLBPairHourData(event.block.timestamp, lbPair as LBPair, true);
  loadLBPairDayData(event.block.timestamp, lbPair as LBPair, true);
  loadTraderJoeDayData(event.block.timestamp, true);

  // TokenX
  tokenX.totalValueLocked = tokenX.totalValueLocked.minus(totalAmountX);
  tokenX.totalValueLockedUSD = tokenX.totalValueLocked.times(
    tokenX.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenX.save();

  // TokenY
  tokenY.totalValueLocked = tokenY.totalValueLocked.minus(totalAmountY);
  tokenY.totalValueLockedUSD = tokenY.totalValueLocked.times(
    tokenY.derivedAVAX.times(bundle.avaxPriceUSD),
  );
  tokenY.save();

  // User
  loadUser(event.params.to);
}

export function handleProtocolFeesCollected(
  event: CollectedProtocolFees,
): void {
  // handle sJOE payout calculations here
  // NOTE: this event will split amount recieved to multiple addresses
  // - sJOE is just one of them so this mapping should be modified in future

  const lbPair = loadLbPair(event.address);

  if (!lbPair) {
    return;
  }

  // update pricing
  updateAvaxInUsdPricing();
  updateTokensDerivedAvax(lbPair);

  // price bundle
  const bundle = loadBundle();

  const tokenX = loadToken(Address.fromString(lbPair.tokenX));
  const tokenY = loadToken(Address.fromString(lbPair.tokenY));

  const fees = decodeAmounts(event.params.protocolFees);
  const amountX = formatTokenAmountByDecimals(fees[0], tokenX.decimals);
  const amountY = formatTokenAmountByDecimals(fees[1], tokenY.decimals);
  const derivedAmountAVAX = amountX
    .times(tokenX.derivedAVAX)
    .plus(amountY.times(tokenY.derivedAVAX));

  const sJoeDayData = loadSJoeDayData(event.block.timestamp);
  sJoeDayData.amountX = sJoeDayData.amountX.plus(amountX);
  sJoeDayData.amountY = sJoeDayData.amountY.plus(amountY);
  sJoeDayData.collectedAVAX = sJoeDayData.collectedAVAX.plus(derivedAmountAVAX);
  sJoeDayData.collectedUSD = sJoeDayData.collectedUSD.plus(
    derivedAmountAVAX.times(bundle.avaxPriceUSD),
  );
  sJoeDayData.save();
}

export function handleTransferBatch(event: TransferBatch): void {
  const lbPair = loadLbPair(event.address);
  if (!lbPair) {
    return;
  }

  // lbPair.txCount = lbPair.txCount.plus(BIG_INT_ONE);
  // lbPair.save();

  // const lbFactory = loadLBFactory();
  // lbFactory.txCount = lbFactory.txCount.plus(BIG_INT_ONE);
  // lbFactory.save();

  // loadTraderJoeHourData(event.block.timestamp, true);
  // loadTraderJoeDayData(event.block.timestamp, true);
  // loadLBPairDayData(event.block.timestamp, lbPair as LBPair, true);
  // loadLBPairHourData(event.block.timestamp, lbPair as LBPair, true);

  // const transaction = loadTransaction(event);

  const amountsLength = event.params.amounts.length;

  for (let i = 0; i < amountsLength; i++) {
    const id = event.params.ids[i];
    const amount = event.params.amounts[i];
    const from = event.params.from;
    const to = event.params.to;

    addLiquidityPosition(lbPair, to, id, amount);

    removeLiquidityPosition(lbPair, from, id, amount);

    const isMint = ADDRESS_ZERO.equals(from);
    const isBurn = ADDRESS_ZERO.equals(to);

    // mint: increase bin totalSupply
    if (isMint) {
      trackBin(
        lbPair,
        id.toU32(),
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        amount, // minted
        BIG_INT_ZERO,
      );
    }

    // burn: decrease bin totalSupply
    if (isBurn) {
      trackBin(
        lbPair,
        id.toU32(),
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        BIG_DECIMAL_ZERO,
        BIG_INT_ZERO,
        amount, // burned
      );
    }

    // const transfer = new Transfer(
    //   transaction.id
    //     .concat("#")
    //     .concat(lbPair.txCount.toString())
    //     .concat("#")
    //     .concat(i.toString()),
    // );
    // transfer.transaction = transaction.id;
    // transfer.timestamp = event.block.timestamp.toI32();
    // transfer.lbPair = lbPair.id;
    // transfer.isBatch = true;
    // transfer.batchIndex = i;
    // transfer.isMint = isMint;
    // transfer.isBurn = isBurn;
    // transfer.binId = id;
    // transfer.amount = amount;
    // transfer.sender = event.params.sender;
    // transfer.from = from;
    // transfer.to = to;
    // transfer.origin = event.transaction.from;
    // transfer.logIndex = event.logIndex;

    // transfer.save();
  }
}

export function handleStaticFeeParametersSet(
  event: StaticFeeParametersSet,
): void {
  const id = event.address.toHexString();
  let lbPairParameter = LBPairParameterSet.load(id);

  if (!lbPairParameter) {
    lbPairParameter = new LBPairParameterSet(id);
    lbPairParameter.lbPair = id;
  }

  lbPairParameter.sender = event.params.sender;
  lbPairParameter.baseFactor = event.params.baseFactor;
  lbPairParameter.filterPeriod = event.params.filterPeriod;
  lbPairParameter.decayPeriod = event.params.decayPeriod;
  lbPairParameter.reductionFactor = event.params.reductionFactor;
  lbPairParameter.variableFeeControl = event.params.variableFeeControl;
  lbPairParameter.protocolShare = event.params.protocolShare;
  lbPairParameter.protocolSharePct = event.params.protocolShare;
  lbPairParameter.maxVolatilityAccumulator =
    event.params.maxVolatilityAccumulator;

  lbPairParameter.save();
}
