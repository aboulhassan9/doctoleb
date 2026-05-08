export default function SelectInput(props) {
  return (
    <select
      {...props}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
    />
  );
}
