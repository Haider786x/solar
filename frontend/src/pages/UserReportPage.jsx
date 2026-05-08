import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DailyPredictionTable from "../components/DailyPredictionTable";
import MonthlyLineChartWithTable from "../components/MonthlyLineChartWithTable";
import StatsStrip from "../components/StatsStrip";
import UserProfileCard from "../components/UserProfileCard";
import { fetchDailyPredictionsByUserId, fetchSolarReportByUserId, fetchUserById } from "../services/api";
import { exportReportToExcel } from "../utils/exportToExcel";

const UserReportPage = () => {
	const { userId } = useParams();
	const navigate = useNavigate();
	const [user, setUser] = useState(null);
	const [report, setReport] = useState(null);
	const [dailyPredictions, setDailyPredictions] = useState([]);
	const [reportSource, setReportSource] = useState("pvgis");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");
	const [dailyPredictionError, setDailyPredictionError] = useState("");

	const readPageData = useCallback(async () => {
		const [userResult, reportResult, dailyPredictionResult] = await Promise.allSettled([
			fetchUserById(userId),
			fetchSolarReportByUserId(userId),
			fetchDailyPredictionsByUserId(userId)
		]);

		if (userResult.status === "rejected") {
			throw userResult.reason;
		}

		if (reportResult.status === "rejected") {
			throw reportResult.reason;
		}

		return {
			userData: userResult.value,
			reportData: reportResult.value,
			dailyPredictionData: dailyPredictionResult.status === "fulfilled" && Array.isArray(dailyPredictionResult.value)
				? dailyPredictionResult.value
				: [],
			dailyPredictionErrorMessage: dailyPredictionResult.status === "rejected"
				? dailyPredictionResult.reason?.message || "Daily prediction history is unavailable."
				: ""
		};
	}, [userId]);

	const applyPageData = useCallback((pageData) => {
		setUser(pageData.userData);
		setReport(pageData.reportData);
		setDailyPredictions(pageData.dailyPredictionData);
		setDailyPredictionError(pageData.dailyPredictionErrorMessage);
	}, []);

	const loadPageData = useCallback(async (isRefresh = false) => {
		if (isRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError("");
		setDailyPredictionError("");

		try {
			const pageData = await readPageData();
			applyPageData(pageData);
		} catch (err) {
			setError(err.message || "Failed to load report");
			setDailyPredictions([]);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [applyPageData, readPageData]);

	useEffect(() => {
		if (!userId) {
			navigate("/", { replace: true });
			return;
		}

		let isActive = true;

		const loadInitialPageData = async () => {
			await Promise.resolve();

			if (!isActive) return;

			setLoading(true);
			setError("");
			setDailyPredictionError("");

			try {
				const pageData = await readPageData();

				if (!isActive) return;

				applyPageData(pageData);
			} catch (err) {
				if (!isActive) return;

				setError(err.message || "Failed to load report");
				setDailyPredictions([]);
			} finally {
				if (isActive) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		};

		loadInitialPageData();

		return () => {
			isActive = false;
		};
	}, [userId, navigate, readPageData, applyPageData]);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8f9_100%)] px-3 py-5 sm:px-4 sm:py-6">
			<div className="mx-auto max-w-7xl">
				<div className="mb-5">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Solar Report</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">User Report Overview</h1>
				</div>

				<div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
					<button 
						type="button" 
						onClick={() => navigate("/")}
						className="w-full rounded-xl border border-slate-400/60 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:shadow-md"
					>
						Back to Dashboard
					</button>
					<button 
						type="button" 
						onClick={() => loadPageData(true)}
						disabled={refreshing}
						className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
					>
						{refreshing ? "Refreshing..." : "Refresh report"}
					</button>
					{!loading && !error && report && (
						<button 
							type="button" 
							onClick={() => exportReportToExcel(report, user)}
							className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
						>
							Download Report
						</button>
					)}
				</div>

				{loading && <p className="px-1 py-3 text-sm font-semibold text-blue-700">Generating report from AIML...</p>}
				{error && <p className="px-1 py-3 text-sm font-semibold text-rose-700">{error}</p>}

				{!loading && !error && (
					<div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
						<UserProfileCard user={user} />
						<div className="space-y-4">
							{/* Tabs to switch between PVGIS and PVWATTS results saved in DB */}
							<div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100/60 p-1 backdrop-blur-sm">
								<button
									className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ease-out ${
										reportSource === "pvgis"
											? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105"
											: "text-slate-600 hover:text-slate-900 hover:bg-white/40"
									}`}
									onClick={() => setReportSource("pvgis")}
								>
									PVGIS
								</button>
								<button
									className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ease-out ${
										reportSource === "pvwatts"
											? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 scale-105"
											: "text-slate-600 hover:text-slate-900 hover:bg-white/40"
									}`}
									onClick={() => setReportSource("pvwatts")}
								>
									PVWATTS
								</button>
							</div>

							{/* Choose data from report.pvgis or report.pvwatts; fall back to top-level report */}
							{(() => {
								const sourceData = report?.[reportSource] ?? report ?? null;
								return (
									<>
										<StatsStrip report={sourceData} source={reportSource} />
										<MonthlyLineChartWithTable monthlyData={sourceData?.monthly_energy_kwh} />
										<DailyPredictionTable predictions={dailyPredictions} error={dailyPredictionError} />
									</>
								);
							})()}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default UserReportPage;
