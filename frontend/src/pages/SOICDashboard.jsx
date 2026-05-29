import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SOICFleetOverview from "../components/SOIC/SOICFleetOverview";
import SOICActiveAlerts from "../components/SOIC/SOICActiveAlerts";
import SOICWatchlist from "../components/SOIC/SOICWatchlist";
import SOICCriticalSites from "../components/SOIC/SOICCriticalSites";
import SOICBestPerformers from "../components/SOIC/SOICBestPerformers";
import SOICDegradedSites from "../components/SOIC/SOICDegradedSites";
import SOICRecoveredSites from "../components/SOIC/SOICRecoveredSites";

const SOICDashboard = () => {
  const navigate = useNavigate();
  const [fleetMetrics, setFleetMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchFleetMetrics();
  }, []);

  const fetchFleetMetrics = async () => {
    try {
      const backendURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendURL}/soic/fleet-metrics`);
      const result = await response.json();
      setFleetMetrics(result.data || {});
    } catch (error) {
      console.error("Error fetching fleet metrics:", error);
      setFleetMetrics({
        total_sites: 0,
        healthy_sites: 0,
        warning_sites: 0,
        critical_sites: 0,
        open_alerts: 0,
        average_fleet_health: 0
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8ff_100%)]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white/88 px-5 pb-6 pt-8 shadow-lg backdrop-blur-md lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <div className="px-4">
            <p className="text-lg font-black leading-none text-slate-900">SolarWiser</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Energy Management</p>
          </div>
        </div>

        <nav className="space-y-2">
          <p className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-100/80 to-transparent px-3 py-2 text-sm font-semibold text-amber-800">
            Operations Center
          </p>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setActiveTab("overview")}
          >
            📊 Fleet Overview
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setActiveTab("alerts")}
          >
            🚨 Active Alerts
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setActiveTab("watchlist")}
          >
            👁️ Watchlist
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setActiveTab("critical")}
          >
            ⚠️ Critical Sites
          </button>
        </nav>

        <div className="mt-auto space-y-2">
          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => navigate("/")}
          >
            ← Back to Users
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:pl-[17.5rem] lg:pr-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Operations Intelligence</div>
            <p className="text-sm font-bold text-slate-800 lg:hidden">SOIC Dashboard</p>
          </div>
          <button
            type="button"
            onClick={fetchFleetMetrics}
            className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            ⟳ Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-5 sm:px-4 sm:py-6 lg:pl-[17.5rem] lg:pr-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Page Title */}
          <section className="space-y-2">
            <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">SOIC</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">Solar Operations Intelligence Center</h1>
            <p className="max-w-3xl text-sm text-slate-600 sm:text-base">
              Real-time fleet monitoring, degradation detection, and maintenance recommendations for your solar installations.
            </p>
          </section>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                <p className="mt-4 text-slate-600 font-semibold">Loading fleet metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Fleet Overview */}
              {activeTab === "overview" && (
                <>
                  <SOICFleetOverview metrics={fleetMetrics} />
                  
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <SOICActiveAlerts />
                    </div>
                    <div>
                      <SOICCriticalSites />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SOICBestPerformers />
                    <SOICDegradedSites />
                  </div>

                  <SOICRecoveredSites />
                </>
              )}

              {/* Alerts Tab */}
              {activeTab === "alerts" && <SOICActiveAlerts fullPage={true} />}

              {/* Watchlist Tab */}
              {activeTab === "watchlist" && <SOICWatchlist fullPage={true} />}

              {/* Critical Sites Tab */}
              {activeTab === "critical" && <SOICCriticalSites fullPage={true} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SOICDashboard;
