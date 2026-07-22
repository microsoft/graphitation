import { IncrementalPayloadQueue } from "../IncrementalPayloadQueue";

describe("IncrementalPayloadQueue", () => {
  type Payload = { value: number; promise: Promise<void> };

  function createPayload(value: number) {
    let resolve: () => void = () => {
      throw new Error("Payload resolver is not initialized.");
    };
    const payload = {
      value,
      promise: new Promise<void>((innerResolve) => {
        resolve = innerResolve;
      }),
    };

    return {
      payload,
      complete() {
        resolve();
      },
    };
  }

  function createQueue() {
    return new IncrementalPayloadQueue<Payload>();
  }

  test("batches payloads completed in the same turn", async () => {
    const queue = createQueue();
    const batch = queue.next();
    const first = createPayload(1);
    const second = createPayload(2);
    const third = createPayload(3);

    queue.add(first.payload);
    queue.add(second.payload);
    queue.add(third.payload);
    first.complete();
    second.complete();
    third.complete();

    await expect(batch).resolves.toMatchObject({
      value: [{ value: 1 }, { value: 2 }, { value: 3 }],
      done: false,
    });
  });

  test("returns values resolved before next()", async () => {
    const queue = createQueue();
    const first = createPayload(1);
    const second = createPayload(2);

    queue.add(first.payload);
    queue.add(second.payload);
    first.complete();
    second.complete();
    await Promise.resolve();

    await expect(queue.next()).resolves.toMatchObject({
      value: [{ value: 1 }, { value: 2 }],
      done: false,
    });
  });

  test("waits for earlier payloads before delivering later payloads", async () => {
    const queue = createQueue();
    const first = createPayload(1);
    const second = createPayload(2);
    queue.add(first.payload);
    queue.add(second.payload);
    const batch = queue.next();
    let isResolved = false;
    batch.then(() => {
      isResolved = true;
    });

    second.complete();
    await Promise.resolve();
    expect(isResolved).toBe(false);

    first.complete();
    await expect(batch).resolves.toMatchObject({
      value: [{ value: 1 }, { value: 2 }],
      done: false,
    });
  });

  test("cancels a pending batch", async () => {
    const queue = createQueue();
    const batch = queue.next();
    await queue.return();

    await expect(batch).resolves.toEqual({
      value: undefined,
      done: true,
    });
    await expect(queue.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
  });
});
