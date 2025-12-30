import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries: number = 2,
  backoff: number = 1000
): Promise<Response> {
  try {
    const res = await fetch(input, init);

    // Retry on 408 (Request Timeout) and 5xx (Server Errors)
    if (retries > 0 && (res.status === 408 || res.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(input, init, retries - 1, backoff * 2);
    }

    return res;
  } catch (error) {
    // Retry on network errors
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(input, init, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = 2,
  backoff: number = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return retryOperation(operation, retries - 1, backoff * 2);
    }
    throw error;
  }
}
