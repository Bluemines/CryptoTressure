export const round = (n: number, dp = 2): number => {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
};
