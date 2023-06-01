/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suite } from "benchmark";

export default class NiceBenchmark {
  private name: string;
  private suite: Suite;

  constructor(name: string) {
    this.name = name;
    this.suite = new Suite(name);
    this.suite.on("cycle", function (event: any) {
      console.log(String(event.target));
    });
  }

  add(name: string, fn: () => Promise<void> | void) {
    this.suite.add(name, {
      defer: true,
      fn: async (deferred: any) => {
        await fn();
        deferred.resolve();
      },
    });
  }

  run(options?: any): Promise<any> {
    return new Promise((resolve) => {
      this.suite.on("complete", resolve);
      console.log(this.name);
      this.suite.run(options);
    });
  }
}
