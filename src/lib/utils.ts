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

export function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}
