import { toPng } from "html-to-image";

// html-to-image's `pixelRatio` option just stretches the already-rasterized
// bitmap onto a bigger canvas, which stays blurry when zoomed. Rendering the
// node into an SVG that's genuinely EXPORT_SCALE times larger (via explicit
// width/height + a matching CSS transform on the un-scaled clone) forces the
// browser to rasterize the text at that higher resolution instead.
const EXPORT_SCALE = 3;

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
    const width = node.scrollWidth;
    const height = node.scrollHeight;
    const dataUrl = await toPng(node, {
      pixelRatio: 1,
      width: width * EXPORT_SCALE,
      height: height * EXPORT_SCALE,
      style: {
        transform: `scale(${EXPORT_SCALE})`,
        transformOrigin: "top left",
        width: `${width}px`,
        height: `${height}px`,
      },
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
