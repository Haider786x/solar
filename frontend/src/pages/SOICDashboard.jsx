import { useEffect, useState } from "react";
import SOICActiveAlerts from "../components/SOIC/SOICActiveAlerts";
import SOICBestPerformers from "../components/SOIC/SOICBestPerformers";
import SOICCriticalSites from "../components/SOIC/SOICCriticalSites";
import SOICDegradedSites from "../components/SOIC/SOICDegradedSites";
import SOICFleetOverview from "../components/SOIC/SOICFleetOverview";
import SOICRecoveredSites from "../components/SOIC/SOICRecoveredSites";
import SOICWatchlist from "../components/SOIC/SOICWatchlist";
import {
fetchSOICActiveAlerts,
fetchSOICAlerts,
fetchSOICFleetMetrics,
fetchSOICHealthScores,
fetchSOICWatchlist
} from "../services/soicApi";

const SOICDashboard = () => {
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [activeAlerts, setActiveAlerts] = useState([]);
const [allAlerts, setAllAlerts] = useState([]);
const [watchlist, setWatchlist] = useState([]);
const [fleetMetrics, setFleetMetrics] = useState(null);
const [healthScores, setHealthScores] = useState([]);

useEffect(() => {
let mounted = true;
const load = async () => {
setLoading(true);
setError("");
try {
const [active, all, watch, metrics, health] = await Promise.all([
fetchSOICActiveAlerts(),
fetchSOICAlerts(),
fetchSOICWatchlist(),
fetchSOICFleetMetrics(),
fetchSOICHealthScores()
]);
if (!mounted) return;
setActiveAlerts(Array.isArray(active) ? active : []);
setAllAlerts(Array.isArray(all) ? all : []);
setWatchlist(Array.isArray(watch) ? watch : []);
setFleetMetrics(metrics || null);
setHealthScores(Array.isArray(health) ? health : []);
} catch (err) {
if (!mounted) return;
setError(err.message || "Failed to load SOIC dashboard");
} finally {
if (mounted) setLoading(false);
}
};
load();
return () => {
mounted = false;
};
}, []);

if (loading) return <div className="p-6 text-sm font-semibold text-blue-700">Loading SOIC dashboard...</div>;
if (error) return <div className="p-6 text-sm font-semibold text-red-700">{error}</div>;

return (
<div className="min-h-screen bg-slate-50 px-4 py-6">
<div className="mx-auto max-w-7xl space-y-4">
<section>
<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SOIC</p>
<h1 className="text-2xl font-bold text-slate-900">Solar Operations Intelligence Center</h1>
</section>
<SOICFleetOverview metrics={fleetMetrics} healthScores={healthScores} activeAlerts={activeAlerts} />
<SOICActiveAlerts alerts={activeAlerts} />
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
<SOICWatchlist items={watchlist} />
<SOICCriticalSites alerts={activeAlerts} />
<SOICBestPerformers metrics={fleetMetrics} />
<SOICDegradedSites metrics={fleetMetrics} />
</div>
<SOICRecoveredSites alerts={allAlerts} />
</div>
</div>
);
};

export default SOICDashboard;
