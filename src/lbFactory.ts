import {
  LBFactory as LBFactoryABI,
  FlashLoanFeeSet,
  LBPairCreated,
  LBPairIgnoredStateChanged,
  FeeRecipientSet,
  PresetSet,
} from "../generated/LBFactory/LBFactory";
import {
  loadLBFactory,
  createLBPair,
  loadBundle,
  loadLbPair,
} from "./entities";
import { BIG_INT_ONE, BIG_INT_ZERO } from "./constants";
import { log } from "@graphprotocol/graph-ts";

export function handleFlashLoanFeeSet(event: FlashLoanFeeSet): void {
  const contract = LBFactoryABI.bind(event.address);
  const flashloanFee = contract.try_getFlashLoanFee();
  const lbFactory = loadLBFactory();

  if (flashloanFee.reverted) {
    lbFactory.flashloanFee = BIG_INT_ZERO;
  } else {
    lbFactory.flashloanFee = flashloanFee.value;
  }

  lbFactory.save();
}

export function handleLBPairCreated(event: LBPairCreated): void {
  loadBundle();
  const lbPair = createLBPair(event.params.LBPair, event.block);

  if (!lbPair) {
    return;
  }

  const lbFactory = loadLBFactory();
  lbFactory.pairCount = lbFactory.pairCount.plus(BIG_INT_ONE);
  lbFactory.save();
}

export function handleLBPairIgnoredStateChanged(
  event: LBPairIgnoredStateChanged,
): void {
  const lbPair = loadLbPair(event.params.LBPair);
  if (!lbPair) {
    log.error(
      "LBPairIgnoredStateChanged event received for non-existent LBPair: {}",
      [event.params.LBPair.toHexString()],
    );
    return;
  }
  lbPair.ignored = event.params.ignored;
  lbPair.save();
}

export function handleFeeRecipientSet(event: FeeRecipientSet): void {
  const lbFactory = loadLBFactory();
  lbFactory.feeRecipient = event.params.newRecipient;
  lbFactory.save();
}
