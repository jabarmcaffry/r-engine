// Drop-in replacement for jsr:@std/async — debounce.

export interface DebouncedFunction<T extends Array<unknown>> {
  (...args: T): void;
  clear(): void;
  flush(): void;
  readonly pending: boolean;
}

export function debounce<T extends Array<unknown>>(
  fn: (this: DebouncedFunction<T>, ...args: T) => void,
  wait: number,
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let flush: (() => void) | null = null;

  const debounced = ((...args: T) => {
    debounced.clear();
    flush = () => {
      debounced.clear();
      fn.call(debounced, ...args);
    };
    timeout = setTimeout(flush, wait);
  }) as DebouncedFunction<T>;

  debounced.clear = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      flush = null;
    }
  };

  debounced.flush = () => {
    flush?.();
  };

  Object.defineProperty(debounced, "pending", {
    get: () => timeout !== null,
  });

  return debounced;
}
