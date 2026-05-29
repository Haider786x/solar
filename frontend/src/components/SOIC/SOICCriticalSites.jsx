const SOICCriticalSites = ({ alerts = [] }) => {
const critical = alerts.filter((item) => ["P4", "P5"].includes(item.priority)).slice(0, 6);
return (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Critical Sites</h2>
<ul className="mt-3 space-y-2 text-sm">
{critical.length ? critical.map((alert) => (
<li key={alert._id} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
{alert.title} ({alert.priority})
</li>
)) : <li className="text-slate-500">No critical sites currently.</li>}
</ul>
</section>
);
};

export default SOICCriticalSites;
