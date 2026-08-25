import { toPng } from "html-to-image";

/**
 * Exports a DOM node as a high-resolution PNG. Temporarily disables clipping
 * (overflow-hidden / overflow-y-auto) on the node and its scrollable
 * descendant (marked with [data-export-scroll]) so the full schedule is
 * captured, not just the visible scrolled portion.
 */
export async function exportElementAsImage(node: HTMLElement, filename: string): Promise<void> {
  const restoreFns: Array<() => void> = [];

  function expand(el: HTMLElement) {
    const prevOverflow = el.style.overflow;
    const prevHeight = el.style.height;
    const prevMaxHeight = el.style.maxHeight;
    el.style.overflow = "visible";
    el.style.height = "auto";
    el.style.maxHeight = "none";
    restoreFns.push(() => {
      el.style.overflow = prevOverflow;
      el.style.height = prevHeight;
      el.style.maxHeight = prevMaxHeight;
    });
  }

  expand(node);
  node.querySelectorAll<HTMLElement>("[data-export-scroll]").forEach(expand);

  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 3,
      backgroundColor: getComputedStyle(node).backgroundColor || "#0B0F14",
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  } finally {
    restoreFns.reverse().forEach((fn) => fn());
  }
}
