"use client";

import { useEffect } from "react";

const VIEWPORT_DEFAULT = "width=device-width, initial-scale=1";

function isFormField(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

/** Reset iOS Safari viewport after input blur when focus zoom sticks. */
export function IosInputZoomFix() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    let resetting = false;

    const resetViewport = () => {
      if (resetting) return;
      const scale = window.visualViewport?.scale ?? 1;
      if (scale <= 1.01) return;
      resetting = true;
      const scrollY = window.scrollY;
      meta.setAttribute("content", `${VIEWPORT_DEFAULT}, maximum-scale=1`);
      requestAnimationFrame(() => {
        meta.setAttribute("content", VIEWPORT_DEFAULT);
        window.scrollTo(0, scrollY);
        resetting = false;
      });
    };

    const onFocusOut = (e: FocusEvent) => {
      if (isFormField(e.target)) resetViewport();
    };

    document.addEventListener("focusout", onFocusOut);
    return () => document.removeEventListener("focusout", onFocusOut);
  }, []);

  return null;
}
