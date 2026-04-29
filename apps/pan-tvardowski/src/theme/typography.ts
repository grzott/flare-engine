export const fontFamily = {
  serif: 'EBGaramond_500Medium',
  serifItalic: 'EBGaramond_500Medium_Italic',
  sans: 'SourceSans3_400Regular',
  sansSemiBold: 'SourceSans3_600SemiBold',
  sansBold: 'SourceSans3_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const typography = {
  displayXl: {
    fontFamily: fontFamily.serif,
    fontSize: 132,
    fontWeight: '500' as const,
    lineHeight: 121,
    letterSpacing: -2.64,
  },
  displayL: {
    fontFamily: fontFamily.serif,
    fontSize: 72,
    fontWeight: '500' as const,
  },
  displayM: {
    fontFamily: fontFamily.serif,
    fontSize: 56,
    fontWeight: '500' as const,
  },
  lede: {
    fontFamily: fontFamily.serifItalic,
    fontSize: 28,
    fontWeight: '500' as const,
  },
  bodyL: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    fontWeight: '400' as const,
  },
  bodyM: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    fontWeight: '400' as const,
  },
  bodyS: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: fontFamily.sansBold,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  monoHud: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.26,
  },
  monoDebug: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '400' as const,
  },
  smallcap: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 2.64,
  },
  // @deprecated use displayM
  h1: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  // @deprecated use displayM
  h2: {
    fontFamily: fontFamily.serif,
    fontSize: 26,
    fontWeight: '800' as const,
  },
  // @deprecated use bodyL
  h3: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  // @deprecated use bodyM
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: '400' as const,
  },
  // @deprecated use smallcap
  caption: {
    fontFamily: fontFamily.sansBold,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  // @deprecated use monoDebug
  xs: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '400' as const,
  },
} as const;
