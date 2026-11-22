export function startPolling<T>(options: {
  load: () => Promise<T>;
  onValue: (value: T) => void;
  onError: (error: Error) => void;
  shouldPoll?: () => boolean;
  delayMs?: number;
}): { refresh: () => Promise<void>; stop: () => void };
