const CLEAR_ICON_SELECTOR = [
  '.ant-select-clear',
  '.ant-input-clear-icon',
  '.ant-picker-clear',
  '.ant-cascader-clear',
  '.ant-tree-select-clear',
  'button[class*="-clear"]',
  'button[class*="clear-icon"]',
  'span[class*="-clear"]',
  'span[class*="clear-icon"]',
].join(', ');

function enforceNonFocusableClearIcons(root: ParentNode = document) {
  try {
    root.querySelectorAll<HTMLElement>(CLEAR_ICON_SELECTOR).forEach((el) => {
      if (el.getAttribute('tabindex') !== '-1') {
        el.setAttribute('tabindex', '-1');
      }
    });
  } catch {
    // Ignore any selector errors in detached nodes
  }
}

export function setupNonFocusableClearIcons(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // 1. Initial pass
  enforceNonFocusableClearIcons();

  // 2. Observe DOM mutations so dynamically rendered clear buttons immediately get tabindex="-1"
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches && node.matches(CLEAR_ICON_SELECTOR)) {
              node.setAttribute('tabindex', '-1');
            }
            enforceNonFocusableClearIcons(node);
          }
        });
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // 3. Ensure tabindex="-1" right before Tab moves focus
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab') {
        enforceNonFocusableClearIcons();
      }
    },
    true
  );

  // 4. Safety net: if a clear button ever receives focus, instantly advance to the next field
  window.addEventListener(
    'focusin',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.matches && target.matches(CLEAR_ICON_SELECTOR)) {
        target.setAttribute('tabindex', '-1');
        const isShift = (window.event as KeyboardEvent)?.shiftKey;

        const focusables = Array.from(
          document.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el !== target && el.offsetParent !== null);

        if (isShift) {
          const prevItems = focusables.filter((el) =>
            Boolean(target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
          );
          if (prevItems.length > 0) {
            prevItems[prevItems.length - 1].focus();
          } else {
            target.blur();
          }
        } else {
          const nextItem = focusables.find((el) =>
            Boolean(target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
          );
          if (nextItem) {
            nextItem.focus();
          } else {
            target.blur();
          }
        }
      }
    },
    true
  );
}

