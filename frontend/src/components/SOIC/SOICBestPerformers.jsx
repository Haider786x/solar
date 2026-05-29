const SOICBestPerformers = ({ metrics }) => {
const list = metrics?.top_5_best_performers || [];
return (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Best Performing Sites</h2>
<ul className="mt-3 space-y-2 text-sm text-slate-700">
{list.length ? list.map((site) => (
<li key={String(site.user_id)} className="rounded border border-emerald-100 bg-emerald-50 px-3 py-2">
Site {String(site.user_id)} · {Number(site.performance_ratio || 0).toFixed(3)}
</li>
)) : <li className="text-slate-500">No data available.</li>}
</ul>
</section>
);
};

export default SOICBestPerformers;
