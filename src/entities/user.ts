import { Address } from "@graphprotocol/graph-ts";
import { User } from "../../generated/schema";
import { BIG_INT_ONE } from "../constants";
import { loadLBFactory } from "./lbFactory";

export function loadUser(address: Address): User {
  let user = User.load(address.toHexString());

  if (!user) {
    const lbFactory = loadLBFactory();
    lbFactory.userCount = lbFactory.userCount.plus(BIG_INT_ONE);
    lbFactory.save();

    user = new User(address.toHexString());
    user.lbTokenApprovals = [];
    user.save();
  }

  return user as User;
}
