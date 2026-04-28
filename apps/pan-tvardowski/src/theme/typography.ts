const h1 = { fontSize: 28, fontWeight: '800' } as const;
const h2 = { fontSize: 26, fontWeight: '800' } as const;
const h3 = { fontSize: 20, fontWeight: '700' } as const;
const label = { fontSize: 14, fontWeight: '700' } as const;
const body = { fontSize: 14, fontWeight: '400' } as const;
const caption = { fontSize: 12, fontWeight: '700' } as const;
const xs = { fontSize: 13, fontWeight: '400' } as const;

export const typography = { h1, h2, h3, label, body, caption, xs } as const;
