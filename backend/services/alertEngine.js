const Alert = require("../models/Alert");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");

const getPriorityForLoss = (lossPercent, days) => {
if (lossPercent >= 25) return "P5";
if (lossPercent >= 12 && days >= 7) return "P4";
if (lossPercent >= 8 && days >= 5) return "P3";
if (lossPercent >= 5 && days >= 5) return "P2";
if (lossPercent >= 3 && days >= 5) return "P1";
if (lossPercent >= 2 && days >= 3) return "P0";
return "P0";
};

const priorityWeight = { P0: 1, P1: 2, P2: 3, P3: 4, P4: 5, P5: 6 };

const getActiveStatus = (existing) => (existing?.status === "CREATED" ? "ACTIVE" : existing?.status || "ACTIVE");

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
status: shouldEscalate ? "ESCALATED" : getActiveStatus(existing),
escalation_count: shouldEscalate ? (existing.escalation_count || 0) + 1 : existing.escalation_count,
escalation_history: shouldEscalate
? [...escalation_history, { from: existing.priority, to: payload.priority, at: new Date() }]
: escalation_history
},
{ returnDocument: "after" }
);
};

async function autoResolveClearedAlerts(userId) {
const activeAlerts = await Alert.find({
user_id: userId,
status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] }
}).lean();

const latest = await SiteDailyPerformance.findOne({ user_id: userId }).sort({ date: -1 }).lean();
if (!latest || latest.performance_ratio < 0.95) return 0;

let resolved = 0;
for (const alert of activeAlerts) {
await Alert.findByIdAndUpdate(alert._id, {
status: "AUTO_RESOLVED",
auto_resolved_at: new Date(),
resolved_at: new Date(),
resolution_reason: "Condition cleared after grace period"
});
resolved += 1;
}
return resolved;
}

async function evaluateAlertsForUser(userId) {
const baseline = await SiteBaselineProfile.findOne({ user_id: userId }).lean();
const threshold = baseline?.baseline_performance_ratio || 1;
const history = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(30).lean();
if (!history.length) return { createdOrUpdated: 0, autoResolved: 0 };

const latest = history[0];
const previousDay = history[1];
const consecutiveUnder = history.findIndex((day) => day.performance_ratio >= threshold) === -1
? history.length
: history.findIndex((day) => day.performance_ratio >= threshold);

const alertsToUpsert = [];
const lossPercent = Math.max(0, ((threshold - latest.performance_ratio) / threshold) * 100);

if (consecutiveUnder >= 5 && lossPercent >= 3) {
alertsToUpsert.push({
user_id: userId,
alert_type: "Persistent Underperformance",
priority: getPriorityForLoss(lossPercent, consecutiveUnder),
title: "Persistent underperformance detected",
description: `${consecutiveUnder} consecutive days below baseline by ${lossPercent.toFixed(2)}%`,
short_message: "Site performance below baseline for multiple days",
confidence_score: 0.9,
confidence_distribution: { historical: 0.8, baseline: 0.9 },
status: "ACTIVE",
triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
baseline_performance: threshold,
actual_performance: latest.performance_ratio,
variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
consecutive_days_triggered: consecutiveUnder,
possible_causes: ["Soiling", "Inverter efficiency", "Shading"],
days_active: consecutiveUnder
});
}

if (history.length >= 30) {
	const recentMean = history.slice(0, 15).reduce((sum, day) => sum + day.performance_ratio, 0) / 15;
	const olderMean = history.slice(15, 30).reduce((sum, day) => sum + day.performance_ratio, 0) / 15;
	const driftPerDay = (olderMean - recentMean) / 15;
	if (driftPerDay >= 0.02) {
		alertsToUpsert.push({
			user_id: userId,
			alert_type: "Performance Drift",
			priority: "P1",
			title: "Gradual performance drift detected",
			description: `Average drift of ${(driftPerDay * 100).toFixed(2)}% per day over 30 days`,
			short_message: "Gradual decline trend detected",
			confidence_score: 0.78,
			confidence_distribution: { trend_model: 0.78 },
			status: "ACTIVE",
			triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
			baseline_performance: threshold,
			actual_performance: latest.performance_ratio,
			variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
			consecutive_days_triggered: 30,
			possible_causes: ["Module degradation", "Soiling accumulation", "Wiring losses"],
			days_active: 30
		});
	}
}

if (lossPercent >= 25) {
alertsToUpsert.push({
user_id: userId,
alert_type: "Sudden Production Drop",
priority: "P5",
title: "Sudden production drop",
description: `Daily production dropped ${lossPercent.toFixed(2)}% from baseline`,
short_message: "Emergency drop in production",
confidence_score: 0.95,
confidence_distribution: { recent_day: 0.95 },
status: "ACTIVE",
triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
baseline_performance: threshold,
actual_performance: latest.performance_ratio,
variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
consecutive_days_triggered: 1,
possible_causes: ["Grid trip", "Inverter failure", "Site offline"],
days_active: 1
});
}

if (latest.inverter_offline || latest.actual_generation_kwh <= 0) {
alertsToUpsert.push({
user_id: userId,
alert_type: latest.actual_generation_kwh <= 0 ? "Site Offline" : "Communication Failure",
priority: "P5",
title: latest.actual_generation_kwh <= 0 ? "Site is offline" : "Communication failure",
description: latest.actual_generation_kwh <= 0
? "No generation recorded for site"
: "Inverter data unavailable for latest reading",
short_message: "Emergency operational issue",
confidence_score: 0.93,
confidence_distribution: { telemetry: 0.93 },
status: "ACTIVE",
triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
baseline_performance: threshold,
actual_performance: latest.performance_ratio,
variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
consecutive_days_triggered: 1,
possible_causes: ["Inverter disconnected", "Network issue", "Hardware fault"],
days_active: 1
});
}

if (latest.inverter_offline && history.slice(0, 2).every((day) => day.inverter_offline)) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Communication Failure",
	priority: "P4",
	title: "Communication failure for 2+ days",
	description: "Inverter telemetry unavailable for at least two consecutive days",
	short_message: "Communication reliability issue",
	confidence_score: 0.9,
	confidence_distribution: { telemetry_gap: 0.9 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: 2,
	possible_causes: ["Network outage", "Inverter modem issue"],
	days_active: 2
});
}

if (latest.avg_cloud_cover_percent <= 30 && latest.performance_ratio < threshold * 0.8) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Weather Mismatch",
	priority: "P2",
	title: "Weather mismatch detected",
	description: "Good weather but production remains below expected levels",
	short_message: "Low generation despite clear weather",
	confidence_score: 0.76,
	confidence_distribution: { weather: 0.82, production: 0.7 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: consecutiveUnder || 1,
	possible_causes: ["Shading", "Soiling", "Electrical mismatch"],
	days_active: consecutiveUnder || 1
});
}

if (latest.is_data_quality_issue) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Data Quality Issue",
	priority: "P1",
	title: "Data quality issue detected",
	description: "Sensor or telemetry quality concerns detected in incoming data",
	short_message: "Potential sensor glitch",
	confidence_score: 0.72,
	confidence_distribution: { telemetry_quality: 0.72 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: 1,
	possible_causes: ["Sensor glitch", "Malformed telemetry packet"],
	days_active: 1
});
}

if (latest.avg_temperature_c >= 45 && latest.performance_ratio < threshold * 0.85) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Thermal Issue",
	priority: "P2",
	title: "Thermal-related production drop",
	description: "High temperature correlated with power drop",
	short_message: "Thermal derating pattern observed",
	confidence_score: 0.79,
	confidence_distribution: { thermal: 0.79 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: 1,
	possible_causes: ["Ambient heat", "Inverter thermal throttling"],
	days_active: 1
});
}

if (latest.avg_cloud_cover_percent <= 35 && latest.performance_ratio < threshold * 0.75 && latest.avg_temperature_c < 40) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Shading Detection",
	priority: "P2",
	title: "Potential new shading pattern",
	description: "Unexplained low output under favorable weather suggests shading",
	short_message: "Potential shading impact detected",
	confidence_score: 0.7,
	confidence_distribution: { shading_model: 0.7 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: consecutiveUnder || 1,
	possible_causes: ["Vegetation growth", "New nearby obstruction"],
	days_active: consecutiveUnder || 1
});
}

if (latest.is_anomaly) {
alertsToUpsert.push({
user_id: userId,
alert_type: "Anomaly Detected",
priority: "P2",
title: "Statistical anomaly detected",
description: `Z-score anomaly at ${latest.anomaly_score.toFixed(2)}`,
short_message: "Performance outlier identified",
confidence_score: 0.8,
confidence_distribution: { anomaly_model: 0.8 },
status: "ACTIVE",
triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
baseline_performance: threshold,
actual_performance: latest.performance_ratio,
variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
consecutive_days_triggered: 1,
possible_causes: ["Transient weather", "Sensor drift"],
days_active: 1
});
}

if (
previousDay &&
previousDay.performance_ratio < threshold &&
latest.performance_ratio >= threshold &&
latest.performance_ratio >= 0.95
) {
alertsToUpsert.push({
	user_id: userId,
	alert_type: "Recovery Alert",
	priority: "P0",
	title: "Site recovered to normal operation",
	description: "Previously degraded site returned to normal baseline performance",
	short_message: "Performance has recovered",
	confidence_score: 0.85,
	confidence_distribution: { recovery_model: 0.85 },
	status: "ACTIVE",
	triggered_at: new Date(`${latest.date}T00:00:00.000Z`),
	baseline_performance: threshold,
	actual_performance: latest.performance_ratio,
	variance_from_baseline: Number((latest.performance_ratio - threshold).toFixed(4)),
	consecutive_days_triggered: 1,
	possible_causes: ["Issue resolved", "Maintenance completed"],
	days_active: 1
});
}

let createdOrUpdated = 0;
for (const alertPayload of alertsToUpsert) {
await createOrUpdateAlert(alertPayload);
createdOrUpdated += 1;
}

await SiteDailyPerformance.findByIdAndUpdate(latest._id, {
alert_triggered: alertsToUpsert.length > 0,
alert_types_triggered: alertsToUpsert.map((item) => item.alert_type)
});

const autoResolved = await autoResolveClearedAlerts(userId);
return { createdOrUpdated, autoResolved };
}

module.exports = {
evaluateAlertsForUser
};
