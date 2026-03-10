import { BigInt } from "@graphprotocol/graph-ts";
import {
  TraderJoeDayData,
  Token,
  LBPairDayData,
  LBPairHourData,
  LBPair,
  SJoeDayData,
} from "../../generated/schema";
import { loadLBFactory } from "./lbFactory";
import { loadBundle } from "./bundle";
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO, BIG_INT_ONE } from "../constants";
import { safeDiv } from "../utils";

export function loadTraderJoeDayData(
  timestamp: BigInt,
  update: bool
): TraderJoeDayData {
  const SECONDS_IN_DAY = BigInt.fromI32(60 * 60 * 24);
  const dayId = timestamp.div(SECONDS_IN_DAY);
  const dayStartTimestamp = dayId.times(SECONDS_IN_DAY);

  const lbFactory = loadLBFactory();
  let traderJoeDayData = TraderJoeDayData.load(dayId.toString());
  if (!traderJoeDayData) {
    traderJoeDayData = new TraderJoeDayData(dayId.toString());
    traderJoeDayData.date = dayStartTimestamp.toI32();
    traderJoeDayData.factory = lbFactory.id;

    traderJoeDayData.volumeAVAX = BIG_DECIMAL_ZERO;
    traderJoeDayData.volumeUSD = BIG_DECIMAL_ZERO;
    traderJoeDayData.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    traderJoeDayData.totalValueLockedAVAX = BIG_DECIMAL_ZERO;
    traderJoeDayData.totalValueLockedUSD = BIG_DECIMAL_ZERO;
    traderJoeDayData.feesUSD = BIG_DECIMAL_ZERO;
    traderJoeDayData.save();
  }

  if (update) {
    traderJoeDayData.totalValueLockedAVAX = lbFactory.totalValueLockedAVAX;
    traderJoeDayData.totalValueLockedUSD = lbFactory.totalValueLockedUSD;
    traderJoeDayData.save();
  }

  return traderJoeDayData as TraderJoeDayData;
}

export function loadLBPairHourData(
  timestamp: BigInt,
  lbPair: LBPair,
  update: bool
): LBPairHourData {
  const SECONDS_IN_HOUR = BigInt.fromI32(60 * 60);
  const hourId = timestamp.div(SECONDS_IN_HOUR);
  const hourStartTimestamp = hourId.times(SECONDS_IN_HOUR);

  const id = lbPair.id.concat("-").concat(hourStartTimestamp.toString());

  let lbPairHourData = LBPairHourData.load(id);
  if (!lbPairHourData) {
    lbPairHourData = new LBPairHourData(id);
    lbPairHourData.date = hourStartTimestamp.toI32();
    lbPairHourData.lbPair = lbPair.id;
    lbPairHourData.tokenX = lbPair.tokenX;
    lbPairHourData.tokenY = lbPair.tokenY;
    lbPairHourData.reserveX = lbPair.reserveX;
    lbPairHourData.reserveY = lbPair.reserveY;
    lbPairHourData.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairHourData.volumeTokenX = BIG_DECIMAL_ZERO;
    lbPairHourData.volumeTokenY = BIG_DECIMAL_ZERO;
    lbPairHourData.volumeUSD = BIG_DECIMAL_ZERO;
    lbPairHourData.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    lbPairHourData.feesUSD = BIG_DECIMAL_ZERO;
    lbPairHourData.save();
  }

  if (update) {
    lbPairHourData.reserveX = lbPair.reserveX;
    lbPairHourData.reserveY = lbPair.reserveY;
    lbPairHourData.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairHourData.save();
  }

  return lbPairHourData as LBPairHourData;
}

export function loadLBPairDayData(
  timestamp: BigInt,
  lbPair: LBPair,
  update: bool
): LBPairDayData {
  const SECONDS_IN_DAY = BigInt.fromI32(60 * 60 * 24);
  const dayId = timestamp.div(SECONDS_IN_DAY);
  const dayStartTimestamp = dayId.times(SECONDS_IN_DAY);

  const id = lbPair.id.concat("-").concat(dayStartTimestamp.toString());

  let lbPairDayData = LBPairDayData.load(id);
  if (!lbPairDayData) {
    lbPairDayData = new LBPairDayData(id);
    lbPairDayData.date = dayStartTimestamp.toI32();
    lbPairDayData.lbPair = lbPair.id;
    lbPairDayData.tokenX = lbPair.tokenX;
    lbPairDayData.tokenY = lbPair.tokenY;
    lbPairDayData.reserveX = lbPair.reserveX;
    lbPairDayData.reserveY = lbPair.reserveY;
    lbPairDayData.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairDayData.volumeTokenX = BIG_DECIMAL_ZERO;
    lbPairDayData.volumeTokenY = BIG_DECIMAL_ZERO;
    lbPairDayData.volumeUSD = BIG_DECIMAL_ZERO;
    lbPairDayData.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    lbPairDayData.feesUSD = BIG_DECIMAL_ZERO;
    lbPairDayData.save();
  }

  if (update) {
    lbPairDayData.reserveX = lbPair.reserveX;
    lbPairDayData.reserveY = lbPair.reserveY;
    lbPairDayData.totalValueLockedUSD = lbPair.totalValueLockedUSD;
    lbPairDayData.save();
  }

  return lbPairDayData as LBPairDayData;
}

export function loadSJoeDayData(timestamp: BigInt): SJoeDayData {
  const SECONDS_IN_DAY = BigInt.fromI32(60 * 60 * 24);
  const dayId = timestamp.div(SECONDS_IN_DAY);
  const dayStartTimestamp = dayId.times(SECONDS_IN_DAY);

  let sJoeDayData = SJoeDayData.load(dayId.toString());
  if (!sJoeDayData) {
    sJoeDayData = new SJoeDayData(dayId.toString());
    sJoeDayData.date = dayStartTimestamp.toI32();
    sJoeDayData.amountX = BIG_DECIMAL_ZERO;
    sJoeDayData.amountY = BIG_DECIMAL_ZERO;
    sJoeDayData.collectedAVAX = BIG_DECIMAL_ZERO;
    sJoeDayData.collectedUSD = BIG_DECIMAL_ZERO;

    sJoeDayData.save();
  }

  return sJoeDayData as SJoeDayData;
}
