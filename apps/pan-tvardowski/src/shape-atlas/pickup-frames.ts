import { PICKUP_DEFS } from '../visual-spec/pickups';
import { type FrameBuild, addShapeEntity } from './types';

export function buildPickupFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

  for (const pickup of PICKUP_DEFS) {
    addShapeEntity(frames, pickup.id as string, pickup.shapes);
  }

  return frames;
}
