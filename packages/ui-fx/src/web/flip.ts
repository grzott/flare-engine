// The reflow still running on each element, so the next one can take it off before measuring.
const running = new WeakMap<Element, Animation>();

/**
 * Animate the children of `container` from where they were to where they now are (FLIP). Call it
 * right after the layout changed, in the same frame: `before` holds each child's
 * `getBoundingClientRect()` from before the change. A child that is not in `before`, or that did
 * not move, is left alone. Only the position is animated, never the size.
 *
 * `duration` is in seconds. The offset is added on top of the child's own transform and of any
 * live preset playing on it, and nothing is left on the child once it has run.
 */
export function flipReflow(
  container: HTMLElement,
  before: Map<Element, DOMRect>,
  duration: number,
): void {
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const was = before.get(child);
    if (was === undefined) continue;
    // An earlier reflow still moving the child would offset the box measured next.
    running.get(child)?.cancel();
    running.delete(child);
    const now = child.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (dx === 0 && dy === 0) continue;
    running.set(
      child,
      child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
        { duration: duration * 1000, easing: 'ease-out', composite: 'add' },
      ),
    );
  }
}
