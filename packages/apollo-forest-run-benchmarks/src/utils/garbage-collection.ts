export const garbageCollect = async (): Promise<void> => {
  if (global.gc) {
    global.gc();
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
};
