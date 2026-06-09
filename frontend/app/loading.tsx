export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="h-10 w-10 border-2 border-[#1a1814]/15 border-t-[#1a1814] rounded-full animate-spin" />
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/55">Carregando</p>
      </div>
    </div>
  );
}
