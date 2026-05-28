let resolveBarrier: () => void = () => {};

export const backgroundReady: Promise<void> = new Promise((resolve) => {
  resolveBarrier = resolve;
});

export function resolveBackgroundReady(): void {
  resolveBarrier();
}
