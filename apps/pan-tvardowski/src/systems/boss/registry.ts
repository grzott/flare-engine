import type { BossPattern } from '../../components';
import { babaJagaScript } from './baba-jaga';
import { bazyliszekScript } from './bazyliszek';
import { borowyScript } from './borowy';
import { borutaScript } from './boruta';
import { lucyperScript } from './lucyper';
import { mefistofelesScript } from './mefistofeles';
import { smokScript } from './smok';
import type { PhaseScript } from './types';
import { wodnikScript } from './wodnik';

export const BOSS_SCRIPTS: Record<BossPattern, PhaseScript> = {
  'smok-krzemionkowski': smokScript,
  'borowy-krol': borowyScript,
  'wodnik-wislanny': wodnikScript,
  boruta: borutaScript,
  'baba-jaga': babaJagaScript,
  'bazyliszek-warszawski': bazyliszekScript,
  mefistofeles: mefistofelesScript,
  'lucyper-ksiezycowy': lucyperScript,
};
