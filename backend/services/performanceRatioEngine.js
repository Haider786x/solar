const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const DailyPrediction = require("../models/DailyPrediction");
const UserData = require("../models/data");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");
const { detectAnomaly } = require("../utils/anomalyDetector");

const safeNumber = (value, fallback = 0) => {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
};

const average = (items) => {
const values = items.map(Number).filter(Number.isFinite);
if (!values.length) return 0;
return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const computeWindows = (ratios = []) => ({
daily: ratios[0] ?? 0,
avg7: average(ratios.slice(0, 7)),
avg30: average(ratios.slice(0, 30)),
avg90: average(ratios.slice(0, 90)),
lifetime: average(ratios)
});

async function upsertDailyPerformanceForPrediction(prediction) {
const predicted = safeNumber(prediction?.predicted_kwh, 0);
const actual = safeNumber(prediction?.inverter_real_time_kwh, 0);
const ratio = predicted > 0 ? actual / predicted : 0;
const differenceKwh = actual - predicted;
const differencePercent = predicted > 0 ? (differenceKwh / predicted) * 100 : 0;
const inverterOffline = prediction?.inverter_real_time_kwh === "N/A";

const baseline = await SiteBaselineProfile.findOne({ user_id: prediction.userId }).lean();
const baselineRatio = safeNumber(baseline?.baseline_performance_ratio, 1);
const baselineDriftPercent = baselineRatio > 0 ? ((ratio - baselineRatio) / baselineRatio) * 100 : 0;

const history = await SiteDailyPerformance.find({ user_id: prediction.userId }).sort({ date: -1 }).limit(30).lean();
const anomalyCheck = detectAnomaly(ratio, history.map((item) => item.performance_ratio));

await SiteDailyPerformance.findOneAndUpdate(
{ user_id: prediction.userId, date: prediction.date },
{
user_id: prediction.userId,
date: prediction.date,
predicted_generation_kwh: predicted,
actual_generation_kwh: actual,
inverter_offline: inverterOffline,
inverter_last_seen: inverterOffline ? null : new Date(),
difference_kwh: Number(differenceKwh.toFixed(2)),
difference_percent: Number(differencePercent.toFixed(2)),
performance_ratio: Number(ratio.toFixed(4)),
avg_temperature_c: safeNumber(prediction?.avg_temperature),
avg_cloud_cover_percent: safeNumber(prediction?.avg_cloud_cover),
peak_ghi_w_per_m2: 0,
site_baseline_ratio: Number(baselineRatio.toFixed(4)),
baseline_drift_percent: Number(baselineDriftPercent.toFixed(2)),
global_benchmark_ratio: 1,
is_anomaly: anomalyCheck.isAnomaly,
anomaly_score: Number(anomalyCheck.zScore.toFixed(4)),
is_suspicious: Math.abs(anomalyCheck.zScore) >= 3,
is_data_quality_issue: inverterOffline,
alert_triggered: false,
alert_types_triggered: []
},
{ upsert: true, returnDocument: "after" }
);
}

async function createOrUpdateSiteDailyPerformance({ userId } = {}) {
const query = userId ? { _id: userId } : {};
const users = await UserData.find(query).select("_id").lean();
if (!users.length) return { processedUsers: 0 };

const userIds = users.map((user) => user._id);
const predictions = await DailyPrediction.find({ userId: { $in: userIds } }).sort({ date: -1 }).lean();
for (const prediction of predictions) {
await upsertDailyPerformanceForPrediction(prediction);
}

const windowSummary = [];
for (const id of userIds) {
const ratios = await SiteDailyPerformance.find({ user_id: id }).sort({ date: -1 }).select("performance_ratio").lean();
windowSummary.push({
user_id: id,
...computeWindows(ratios.map((item) => item.performance_ratio))
});
}

return { processedUsers: users.length, windowSummary };
}

module.exports = {
createOrUpdateSiteDailyPerformance,
computeWindows
};
