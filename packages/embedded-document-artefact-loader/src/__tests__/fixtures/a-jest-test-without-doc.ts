describe("a jest test", () => {
  it("does nothing really", async () => {
    const { soTrue } = await import("./another-module-without-doc");
    expect(soTrue()).toBe(true);
  });
});
