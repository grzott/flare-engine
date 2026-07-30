type HeadlineCardProps = {
  value: string;
  unit: string;
  caption: string;
  /**
   * Run-to-run spread. Shown whenever the capture has one, because a headline
   * figure without it invites a reader to treat a 2% move as a regression.
   */
  band?: string;
};

export function HeadlineCard({ value, unit, caption, band }: HeadlineCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-amber-300 text-3xl leading-none">{value}</span>
        <span className="font-mono text-amber-300/70 text-base">{unit}</span>
      </div>
      <p className="text-slate-400 text-sm">{caption}</p>
      {band !== undefined && (
        <p className="text-slate-600 text-xs font-mono" title="Lowest and highest per-run median">
          spread {band}
        </p>
      )}
    </div>
  );
}
