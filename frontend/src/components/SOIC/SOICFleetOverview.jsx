const SOICFleetOverview = ({ metrics, healthScores, activeAlerts }) => {
const cards = [
{ label: "Total Sites", value: metrics?.total_sites ?? 0 },
{ label: "Healthy", value: metrics?.healthy_sites ?? 0 },
{ label: "Warning", value: metrics?.warning_sites ?? 0 },
{ label: "Critical", value: metrics?.critical_sites ?? 0 },
{ label: "Open Alerts", value: activeAlerts?.length ?? 0 },
{ label: "Avg Health", value: healthScores?.length ? (healthScores.reduce((sum, item) => sum + (item.health_score || 0), 0) / healthScores.length).toFixed(1) : "0.0" }
];

return (
<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
{cards.map((card) => (
<div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
<p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
</div>
))}
</section>
);
};

export default SOICFleetOverview;
