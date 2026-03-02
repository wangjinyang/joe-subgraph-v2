import { Bundle } from "../../generated/schema";
import { getAvaxPriceInUSD } from "../utils";

export function loadBundle(): Bundle {
  let bundle = Bundle.load("avaxPriceUSD");

  if (bundle === null) {
    bundle = new Bundle("avaxPriceUSD");
    bundle.avaxPriceUSD = getAvaxPriceInUSD();
    bundle.save();
  }

  return bundle as Bundle;
}
