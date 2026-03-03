/**
 * Debounce helper function
 * Delays function execution and cancels previous invocations if called again within delay window
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(fn, delay) {
  let timeoutId = null;

  const debounced = (...args) => {
    // Cancel previous invocation
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Schedule new invocation
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  // Add cancel method to stop pending debounced calls
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
