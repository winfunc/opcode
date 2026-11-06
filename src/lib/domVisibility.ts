/**
 * Returns true if at least one of the given elements is rendered on screen.
 *
 * An element inside a `display: none` ancestor (for example an inactive tab
 * that stays mounted but hidden) has no client rects. Unlike `offsetParent`,
 * this also works for `position: fixed` elements such as modals.
 *
 * @param elements - Elements to check; `null`/`undefined` entries count as not visible
 */
export function isAnyElementVisible(elements: ReadonlyArray<Element | null | undefined>): boolean {
  return elements.some((el) => !!el && el.getClientRects().length > 0);
}
