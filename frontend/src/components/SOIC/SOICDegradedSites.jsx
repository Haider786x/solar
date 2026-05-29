const SOICDegradedSites = ({ metrics }) => {
const list = metrics?.top_5_worst_performers || [];
return (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Most Degraded Sites</h2>
<ul className="mt-3 space-y-2 text-sm text-slate-700">
{list.length ? list.map((site) => (
<li key={String(site.user_id)} className="rounded border border-orange-100 bg-orange-50 px-3 py-2">
Site {String(site.user_id)} · {Number(site.performance_ratio || 0).toFixed(3)}
</li>
)) : <li className="text-slate-500">No degraded sites currently.</li>}
</ul>
</section>
);
};

export default SOICDegradedSites;
