const colorByPriority = {
P0: "text-blue-700 bg-blue-50",
P1: "text-yellow-700 bg-yellow-50",
P2: "text-orange-700 bg-orange-50",
P3: "text-red-700 bg-red-50",
P4: "text-red-900 bg-red-100",
P5: "text-white bg-red-700"
};

const SOICActiveAlerts = ({ alerts = [] }) => (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Active Alerts</h2>
<div className="mt-3 overflow-x-auto">
<table className="min-w-full text-sm">
<thead>
<tr className="text-left text-slate-500">
<th className="px-2 py-2">Priority</th>
<th className="px-2 py-2">Type</th>
<th className="px-2 py-2">Status</th>
<th className="px-2 py-2">Message</th>
</tr>
</thead>
<tbody>
{alerts.length ? alerts.map((alert) => (
<tr key={alert._id} className="border-t border-slate-100">
<td className="px-2 py-2">
<span className={`rounded px-2 py-1 text-xs font-semibold ${colorByPriority[alert.priority] || "text-slate-700 bg-slate-100"}`}>{alert.priority}</span>
</td>
<td className="px-2 py-2">{alert.alert_type}</td>
<td className="px-2 py-2">{alert.status}</td>
<td className="px-2 py-2">{alert.short_message || alert.title}</td>
</tr>
)) : (
<tr><td className="px-2 py-3 text-slate-500" colSpan={4}>No active alerts.</td></tr>
)}
</tbody>
</table>
</div>
</section>
);

export default SOICActiveAlerts;
