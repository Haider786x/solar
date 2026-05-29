const Alert = require("../models/Alert");
const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");
const SiteTrendAnalysis = require("../models/SiteTrendAnalysis");
const { buildOperationalReasoning } = require("./soicReasoningLayer");

const priorityWeight = { P0: 1, P1: 2, P2: 3, P3: 4, P4: 5, P5: 6 };

const safeNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRatio = (value, fallback = 0) => {
	const ratio = safeNumber(value, fallback);
	if (ratio > 2) return ratio / 100;
	return ratio;
};

const getPriorityForLoss = (lossPercent, days) => {
	if (lossPercent >= 30) return "P5";
	if (lossPercent >= 18 && days >= 3) return "P4";
	if (lossPercent >= 12 && days >= 3) return "P3";
	if (lossPercent >= 8 && days >= 3) return "P2";
	if (lossPercent >= 4 && days >= 3) return "P1";
	return "P0";
};

const getActiveStatus = (existing) => (existing?.status === "CREATED" ? "ACTIVE" : existing?.status || "ACTIVE");

const getTriggeredAt = (dateString) => new Date(`${dateString}T00:00:00.000Z`);

const createOrUpdateAlert = async (payload) => {
	const dayStart = new Date(payload.triggered_at);
	dayStart.setUTCHours(0, 0, 0, 0);
	const dayEnd = new Date(dayStart);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

	const existing = await Alert.findOne({
		user_id: payload.user_id,
		alert_type: payload.alert_type,
		triggered_at: { $gte: dayStart, $lt: dayEnd }
	});

	if (!existing) {
		return Alert.create(payload);
	}

	const shouldEscalate = priorityWeight[payload.priority] > priorityWeight[existing.priority];
	const escalation_history = Array.isArray(existing.escalation_history) ? existing.escalation_history : [];

	return Alert.findByIdAndUpdate(
		existing._id,
		{
			...payload,
			status: payload.status || (shouldEscalate ? "ESCALATED" : getActiveStatus(existing)),
			escalation_count: shouldEscalate ? (existing.escalation_count || 0) + 1 : existing.escalation_count,
			escalation_history: shouldEscalate
				? [...escalation_history, { from: existing.priority, to: payload.priority, at: new Date() }]
				: escalation_history
		},
		{ returnDocument: "after" }
	);
};

async function autoResolveClearedAlerts(userId, baseline) {
	const activeAlerts = await Alert.find({
		user_id: userId,
		status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] }
	}).lean();

	const latest = await SiteDailyPerformance.findOne({ user_id: userId }).sort({ date: -1 }).lean();
	const baselineRatio = normalizeRatio(baseline?.baseline_performance_ratio, normalizeRatio(latest?.site_baseline_ratio, 0.9));
	const warningThreshold = normalizeRatio(baseline?.warning_threshold, baselineRatio * 0.92);
	if (!latest || latest.performance_ratio < warningThreshold || latest.is_data_quality_issue) return 0;

	let resolved = 0;
	for (const alert of activeAlerts) {
		await Alert.findByIdAndUpdate(alert._id, {
			status: "AUTO_RESOLVED",
			auto_resolved_at: new Date(),
			resolved_at: new Date(),
			resolution_reason: "SOIC condition cleared against site baseline"
		});
		resolved += 1;
	}
	return resolved;
}

async function evaluateAlertsForUser(userId) {
	const [user, baseline, history, monthlyReport, trend30] = await Promise.all([
		UserData.findById(userId).lean(),
		SiteBaselineProfile.findOne({ user_id: userId }).lean(),
		SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(30).lean(),
		MonthlyData.findOne({ userDataId: userId }).lean(),
		SiteTrendAnalysis.findOne({ user_id: userId, analysis_period: "30day" }).lean()
	]);

	if (!user || !history.length) return { createdOrUpdated: 0, autoResolved: 0 };

	const latest = history[0];
	const previousDay = history[1];
	const baselineRatio = normalizeRatio(baseline?.baseline_performance_ratio, normalizeRatio(latest.site_baseline_ratio, 0.9));
	const warningThreshold = normalizeRatio(baseline?.warning_threshold, baselineRatio * 0.92);
	const criticalThreshold = normalizeRatio(baseline?.critical_threshold, baselineRatio * 0.85);
	const consecutiveUnder = history.findIndex((day) => normalizeRatio(day.performance_ratio) >= warningThreshold) === -1
		? history.length
		: history.findIndex((day) => normalizeRatio(day.performance_ratio) >= warningThreshold);
	const lossPercent = Math.max(0, ((baselineRatio - normalizeRatio(latest.performance_ratio)) / Math.max(baselineRatio, 0.01)) * 100);
	const hasActualTelemetry = latest.data_source === "daily_prediction_inverter";
	const clearWeather = safeNumber(latest.avg_cloud_cover_percent) <= 35;
	const highTemperature = safeNumber(latest.avg_temperature_c) >= 42;
	const reasoning = buildOperationalReasoning({
		user,
		latest,
		history,
		baseline,
		trend: trend30,
		monthlyReport
	});

	const makePayload = ({
		alertType,
		priority,
		title,
		description,
		shortMessage,
		status = "ACTIVE",
		extra = {}
	}) => ({
		user_id: userId,
		alert_type: alertType,
		priority,
		title,
		description,
		short_message: shortMessage,
		confidence_score: reasoning.confidence_score,
		confidence_distribution: reasoning.confidence_distribution,
		status,
		triggered_at: getTriggeredAt(latest.date),
		baseline_performance: Number(baselineRatio.toFixed(4)),
		actual_performance: Number(normalizeRatio(latest.performance_ratio).toFixed(4)),
		variance_from_baseline: Number((normalizeRatio(latest.performance_ratio) - baselineRatio).toFixed(4)),
		consecutive_days_triggered: consecutiveUnder || 1,
		possible_causes: reasoning.possible_causes,
		maintenance_recommendations: reasoning.maintenance_recommendations,
		projected_risk_timeline_days: reasoning.projected_risk_timeline_days,
		reasoning_summary: reasoning.reasoning_summary,
		data_sources: latest.data_sources || [],
		days_active: consecutiveUnder || 1,
		...extra
	});

	const alertsToUpsert = [];

	if (consecutiveUnder >= 3 && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Persistent Underperformance",
			priority: getPriorityForLoss(lossPercent, consecutiveUnder),
			title: "Persistent underperformance detected",
			description: `${consecutiveUnder} consecutive SOIC snapshots are below the site warning baseline by ${lossPercent.toFixed(2)}%.`,
			shortMessage: "Site performance is below its historical baseline"
		}));
	}

	if (history.length >= 14 && trend30?.trend_direction === "declining" && ["medium", "high"].includes(trend30.trend_severity)) {
		alertsToUpsert.push(makePayload({
			alertType: "Performance Drift",
			priority: trend30.trend_severity === "high" ? "P3" : "P2",
			title: "Gradual performance drift detected",
			description: `30-day trend is declining with slope ${safeNumber(trend30.slope).toFixed(4)} and ${trend30.data_points} data points.`,
			shortMessage: "Gradual decline trend detected"
		}));
	}

	if (hasActualTelemetry && lossPercent >= 25) {
		alertsToUpsert.push(makePayload({
			alertType: "Sudden Production Drop",
			priority: "P5",
			title: "Sudden production drop",
			description: `Inverter generation dropped ${lossPercent.toFixed(2)}% below the SOIC baseline.`,
			shortMessage: "Emergency drop in production"
		}));
	}

	if (hasActualTelemetry && latest.actual_generation_kwh <= 0 && latest.predicted_generation_kwh > 0) {
		alertsToUpsert.push(makePayload({
			alertType: "Site Offline",
			priority: "P5",
			title: "Site appears offline",
			description: "AIML predicted generation for the day, but inverter generation reported zero.",
			shortMessage: "No generation recorded for site"
		}));
	}

	if (latest.is_data_quality_issue) {
		alertsToUpsert.push(makePayload({
			alertType: "Data Quality Issue",
			priority: "P1",
			title: "Inverter telemetry missing",
			description: "SOIC found forecast/report data, but inverter generation telemetry was unavailable for this snapshot.",
			shortMessage: "Telemetry gap detected"
		}));
	}

	if (clearWeather && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Weather Mismatch",
			priority: "P2",
			title: "Weather mismatch detected",
			description: "Low generation occurred under favorable cloud cover, suggesting site-side degradation instead of weather loss.",
			shortMessage: "Low generation despite clear weather"
		}));
	}

	if (highTemperature && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Thermal Issue",
			priority: "P2",
			title: "Thermal-related production drop",
			description: "High temperature coincided with below-baseline performance.",
			shortMessage: "Thermal derating pattern observed"
		}));
	}

	if (clearWeather && !highTemperature && normalizeRatio(latest.performance_ratio) < criticalThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Shading Detection",
			priority: "P2",
			title: "Potential new shading pattern",
			description: "Unexplained low output under favorable weather suggests shading, soiling, or obstruction.",
			shortMessage: "Potential shading impact detected"
		}));
	}

	if (latest.is_anomaly) {
		alertsToUpsert.push(makePayload({
			alertType: "Anomaly Detected",
			priority: "P2",
			title: "Statistical anomaly detected",
			description: `SOIC anomaly score is ${safeNumber(latest.anomaly_score).toFixed(2)}.`,
			shortMessage: "Performance outlier identified"
		}));
	}

	if (
		previousDay &&
		normalizeRatio(previousDay.performance_ratio) < warningThreshold &&
		normalizeRatio(latest.performance_ratio) >= warningThreshold
	) {
		alertsToUpsert.push(makePayload({
			alertType: "Recovery Alert",
			priority: "P0",
			title: "Site recovered to normal operation",
			description: "Previously degraded site returned to its SOIC baseline band.",
			shortMessage: "Performance has recovered",
			status: "AUTO_RESOLVED",
			extra: {
				resolved_at: new Date(),
				auto_resolved_at: new Date(),
				resolution_reason: "Recovered against SOIC baseline"
			}
		}));
	}

	let createdOrUpdated = 0;
	for (const alertPayload of alertsToUpsert) {
		await createOrUpdateAlert(alertPayload);
		createdOrUpdated += 1;
	}

	await SiteDailyPerformance.findByIdAndUpdate(latest._id, {
		alert_triggered: alertsToUpsert.some((item) => item.status !== "AUTO_RESOLVED"),
		alert_types_triggered: alertsToUpsert.map((item) => item.alert_type),
		probable_causes: reasoning.possible_causes,
		maintenance_recommendations: reasoning.maintenance_recommendations,
		projected_risk_timeline_days: reasoning.projected_risk_timeline_days,
		reasoning_summary: reasoning.reasoning_summary,
		analytics_confidence: reasoning.confidence_score
	});

	const autoResolved = await autoResolveClearedAlerts(userId, baseline);
	return { createdOrUpdated, autoResolved };
}

module.exports = {
	evaluateAlertsForUser
};
