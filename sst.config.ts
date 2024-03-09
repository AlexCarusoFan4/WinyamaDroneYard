import { SSTConfig } from "sst";
import { DroneYardStack } from "./stacks/MyStack";

export default {
  config(_input) {
    return {
      name: "WinyamaDroneYard",
      region: "ap-southeast-2",
    };
  },
  stacks(app) {
    app.stack(DroneYardStack);
  }
} satisfies SSTConfig;
