const SOICRecoveredSites = ({ alerts = [] }) => {
const recovered = alerts.filter((item) => item.status === "AUTO_RESOLVED" || item.status === "RESOLVED").slice(0, 6);
return (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Recently Recovered Sites</h2>
<ul className="mt-3 space-y-2 text-sm text-slate-700">
{recovered.length ? recovered.map((alert) => (
<li key={alert._id} className="rounded border border-blue-100 bg-blue-50 px-3 py-2">
{alert.title}
</li>
)) : <li className="text-slate-500">No recent recoveries.</li>}
</ul>
</section>
);
};

export default SOICRecoveredSites;
