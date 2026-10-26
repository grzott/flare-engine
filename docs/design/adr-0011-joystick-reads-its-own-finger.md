# ADR-0011: `<VirtualJoystick>` reads its own finger's page position, so the knob stops jumping on device

- **Status**: Accepted <!-- owner, 2026-10-26 -->
- **Date**: 2026-10-25
- **Consumer impact**: behaviour-change
- **Release level**: patch

## Context

Verified at HEAD 699a3f4 on 2026-10-25, against the working tree before this row's diff.

The owner ran the manual-test protocol's §1 runner on `0.4.3`: the topdown template, release build,
on an Android phone. The joystick moved the player, but erratically. With the finger held to the
right, the knob left the stick's ring.

`packages/react/src/virtual-joystick.tsx:52-62` fed `nativeEvent.locationX` and `locationY` straight
into `updateJoystick` on grant and on every move, taking the stick's centre as half its laid-out
size. That holds only while those coordinates are measured against the stick itself, and on
Android they are not:

- **Android hit-tests every move again.** In React Native `0.83.6`, `JSTouchDispatcher.kt:156-158`
  calls `findTargetTagAndSetCoordinates` on each move. `TouchesHelper.kt:51-65` then measures
  `locationX` against the view under the finger at that moment, while `pageX` stays in root-view
  coordinates.
- **The default knob was a touch target** (`virtual-joystick.tsx:106-108`, no `pointerEvents`).
  The thumb and base slots were already wrapped in `pointerEvents="none"`, but the default knob was
  not. With the finger over the 40-point knob, the reading was measured against the knob's box, so a
  finger 10 points right of centre read as 20 left and 30 up. The knob jumped away, the finger was
  over the ring again, and the next reading was correct, so the knob shook.
- **Past the ring, the reading is measured against whatever is under the finger.** In the templates
  that is the full-screen game view, so the reading is close to the finger's screen position and the
  knob is pulled toward the screen's bottom edge. That is the "outside the bounds" the owner saw.
- **The event's own fields describe the first changed touch.** Fabric fills `locationX` and `pageX`
  on the event from the first changed touch, and the responder receives moves from every finger.
  In the shmup template, which pairs the stick with a fire button, a second finger can drive the
  stick.

react-native-web measures `locationX` against the responder itself (`createResponderEvent.js:133-143`
in its `useResponderEvents` module), which is why the browser checks never saw this. iOS measures it
against the view the touch began on, so a touch that started on the default knob was off by the
knob's position there too.

## Decision

Read the stick's own finger in page coordinates, from an origin taken at grant:

- **At grant**, record the touch's `identifier` and the stick's page origin, `pageX − locationX` and
  `pageY − locationY`. No child of the stick is a touch target, so at that moment `locationX` is
  measured against the stick on every platform.
- **On move**, find the touch with that identifier in the event's `touches` list, falling back to
  the event's own fields when it carries no list. Use its `pageX`/`pageY` minus the origin. A move
  that does not carry the stick's finger is ignored.
- **The default knob** gets `pointerEvents: 'none'` in its style, like the two skin slots.

`updateJoystick` and the rest of `@flare-engine/input` are unchanged; only the component's choice of
coordinates moves.

## Consumer impact

- **Who notices.** Every app that renders `<VirtualJoystick>` on a phone. On Android the stick
  follows the finger, including past the ring, where it holds the edge in the finger's direction.
  On iOS a touch that starts on the default knob no longer jumps. On web nothing changes: there,
  page coordinates from the grant origin equal `locationX` throughout.
- **Who breaks.** No known consumer. Code that relied on the default knob being a touch target
  (a parent listening for touches on it) would stop receiving them; nothing in the engine, the
  templates, Pan Tvardowski or flare-engine-page does that. Pan Tvardowski passes its own `base` and
  `thumb`, which were already not touch targets, and gains the past-the-ring fix. flare-engine-page's
  games read joystick state through `@flare-engine/input`, not this component.
- **Unchanged.** The knob's centre may still travel to `maxRadius`, so half the default knob sits
  past the ring at full deflection. That is the existing design, and the runner's question says so.
- **Migration.** None. No exported name, signature or type changes.
- **Why now.** The topdown template is the first thing a stranger runs, and the stick is its only
  control. As shipped in `0.4.3` it misbehaves on every Android device, and the flip is 2026-10-26.

## Alternatives considered

- **Only make the default knob not a touch target.** Fixes the shaking inside the ring. Past the
  ring the reading is still measured against the game view.
- **Measure the stick with `measureInWindow` on layout.** That is asynchronous, misses any
  movement of the stick after layout, and still needs the per-finger lookup.
- **Clamp the knob visually inside the ring.** Treats the symptom the owner described, not the
  wrong coordinates, and changes the look.
- **Ship it after the flip.** Leaves the first-run template broken on Android for the launch.

## What would reverse this

- React Native measures `locationX` against the responder on Android, as react-native-web already
  does. The page-coordinate path would still be correct, just no longer needed.
- The stick is placed inside something that moves during a drag, such as a scrolling parent. The
  grant origin would go stale, and the origin would have to be re-measured on move.

<!-- symbols-ok: locationX, locationY, pageX, pageY, identifier, touches, pointerEvents,
     nativeEvent.locationX, findTargetTagAndSetCoordinates, measureInWindow, useResponderEvents -->
<!-- reason: React Native touch-event fields, a View style prop, an RN Android internal, an RN
     view method and a react-native-web module, named because the decision is which of them the
     component reads; none is a Flare export. -->
