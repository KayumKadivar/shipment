/**
 * Restarts documents restored from the browser's page cache so Redux authentication
 * begins in a fresh runtime. Ordinary page loads and in-app navigation are unaffected.
 * @param restart Replaces the current document with the logged-out entry point.
 * @returns Removes the listener when the guard is no longer needed.
 */
export function registerSessionRestoreGuard(restart: () => void): () => void {
  /** Restarts only when the browser restores a previously cached document. */
  const handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      restart();
    }
  };

  window.addEventListener("pageshow", handlePageShow);
  return () => window.removeEventListener("pageshow", handlePageShow);
}
