/** Cloud billing trial state. CE has no billing, so there is never a trial. */
export default function useTrial(): {
  isTrial: boolean;
  trialDaysLeft: number;
} {
  return { isTrial: false, trialDaysLeft: 0 };
}
