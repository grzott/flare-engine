// CW7-7 type probe: every assignment below must compile after the fix.
// Before the fix (style typed as ViewStyle) null and array assignments fail.

import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import type { ButtonProps } from '../src/button.js';
import type { DialoguePanelProps } from '../src/dialogue-panel.js';
import type { LabelProps } from '../src/label.js';
import type { ListProps } from '../src/list.js';
import type { MainMenuKitProps } from '../src/main-menu-kit.js';
import type { PanelProps } from '../src/panel.js';
import type { ProgressBarProps } from '../src/progress-bar.js';
import type { ShopPanelProps } from '../src/shop-panel.js';

const arrayView: StyleProp<ViewStyle> = [{ opacity: 1 }, { flex: 1 }];
const falsyView: StyleProp<ViewStyle> = null;
const plainView: StyleProp<ViewStyle> = { flex: 1 };

const arrayText: StyleProp<TextStyle> = [{ fontSize: 12 }, { color: '#fff' }];
const falsyText: StyleProp<TextStyle> = null;
const plainText: StyleProp<TextStyle> = { fontSize: 12 };

// PanelProps
const _pa: PanelProps['style'] = arrayView;
const _pf: PanelProps['style'] = falsyView;
const _pp: PanelProps['style'] = plainView;

// ButtonProps
const _ba: ButtonProps['style'] = arrayView;
const _bf: ButtonProps['style'] = falsyView;
const _bp: ButtonProps['style'] = plainView;

// DialoguePanelProps
const _da: DialoguePanelProps['style'] = arrayView;
const _df: DialoguePanelProps['style'] = falsyView;
const _dp: DialoguePanelProps['style'] = plainView;

// LabelProps (TextStyle)
const _la: LabelProps['style'] = arrayText;
const _lf: LabelProps['style'] = falsyText;
const _lp: LabelProps['style'] = plainText;

// ListProps
const _lia: ListProps['style'] = arrayView;
const _lif: ListProps['style'] = falsyView;
const _lip: ListProps['style'] = plainView;

// MainMenuKitProps
const _ma: MainMenuKitProps['style'] = arrayView;
const _mf: MainMenuKitProps['style'] = falsyView;
const _mp: MainMenuKitProps['style'] = plainView;

// ProgressBarProps
const _bra: ProgressBarProps['style'] = arrayView;
const _brf: ProgressBarProps['style'] = falsyView;
const _brp: ProgressBarProps['style'] = plainView;

// ShopPanelProps
const _sa: ShopPanelProps['style'] = arrayView;
const _sf: ShopPanelProps['style'] = falsyView;
const _sp: ShopPanelProps['style'] = plainView;

// Suppress "unused variable" errors without allocations.
void [
  _pa,
  _pf,
  _pp,
  _ba,
  _bf,
  _bp,
  _da,
  _df,
  _dp,
  _la,
  _lf,
  _lp,
  _lia,
  _lif,
  _lip,
  _ma,
  _mf,
  _mp,
  _bra,
  _brf,
  _brp,
  _sa,
  _sf,
  _sp,
];
