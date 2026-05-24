/** Nominal scenario duration — every scenario runs for this many simulated seconds. */
export const SCENARIO_DURATION_SEC = 30;

/** HP clamp floor — boss HP never goes below this in bench scenarios so the
 *  FSM never reaches the dying state and the scenario keeps ticking. */
export const BOSS_HP_CLAMP_MIN = 1;
