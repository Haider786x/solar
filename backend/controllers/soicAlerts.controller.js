const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const SiteHealthScore = require("../models/SiteHealthScore");
const FleetPerformanceMetrics = require("../models/FleetPerformanceMetrics");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteTrendAnalysis = require("../models/SiteTrendAnalysis");

const respondError = (res, message, error, status = 500) => res.status(status).json({
success: false,
message,
error: error?.message || String(error || "Unknown error")
});

const getAlerts = async (req, res) => {
try {
const alerts = await Alert.find().sort({ created_at: -1 }).lean();
return res.status(200).json({ success: true, data: alerts });
} catch (error) {
return respondError(res, "Failed to fetch alerts", error);
}
};

const getUserAlerts = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const alerts = await Alert.find({ user_id: userId }).sort({ created_at: -1 }).lean();
return res.status(200).json({ success: true, data: alerts });
} catch (error) {
return respondError(res, "Failed to fetch user alerts", error);
}
};

const getActiveAlerts = async (req, res) => {
try {
const alerts = await Alert.find({ status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] } })
.sort({ priority: -1, created_at: -1 })
.lean();
return res.status(200).json({ success: true, data: alerts });
} catch (error) {
return respondError(res, "Failed to fetch active alerts", error);
}
};

const getAlertsByPriority = async (req, res) => {
try {
const { priority } = req.params;
const alerts = await Alert.find({ priority }).sort({ created_at: -1 }).lean();
return res.status(200).json({ success: true, data: alerts });
} catch (error) {
return respondError(res, "Failed to fetch alerts by priority", error);
}
};

const getHealthScores = async (req, res) => {
try {
const scores = await SiteHealthScore.find().sort({ health_score: -1 }).lean();
return res.status(200).json({ success: true, data: scores });
} catch (error) {
return respondError(res, "Failed to fetch health scores", error);
}
};

const getUserHealthScore = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const score = await SiteHealthScore.findOne({ user_id: userId }).lean();
return res.status(200).json({ success: true, data: score });
} catch (error) {
return respondError(res, "Failed to fetch user health score", error);
}
};

const getFleetMetrics = async (req, res) => {
try {
const metrics = await FleetPerformanceMetrics.findOne().sort({ snapshot_date: -1 }).lean();
return res.status(200).json({ success: true, data: metrics });
} catch (error) {
return respondError(res, "Failed to fetch fleet metrics", error);
}
};

const getSitePerformance = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const performance = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).lean();
return res.status(200).json({ success: true, data: performance });
} catch (error) {
return respondError(res, "Failed to fetch site performance", error);
}
};

const getSiteTrends = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const trends = await SiteTrendAnalysis.find({ user_id: userId }).sort({ analysis_period: 1 }).lean();
return res.status(200).json({ success: true, data: trends });
} catch (error) {
return respondError(res, "Failed to fetch trend analysis", error);
}
};

const getWatchlist = async (req, res) => {
try {
const watchlist = await SiteDailyPerformance.find({
performance_ratio: { $gte: 0.88, $lt: 0.95 }
})
.sort({ performance_ratio: 1, date: -1 })
.limit(50)
.lean();
return res.status(200).json({ success: true, data: watchlist });
} catch (error) {
return respondError(res, "Failed to fetch watchlist", error);
}
};

const acknowledgeAlert = async (req, res) => {
try {
const { alertId } = req.params;
if (!mongoose.Types.ObjectId.isValid(alertId)) {
return res.status(400).json({ success: false, message: "Invalid alert id" });
}
const alert = await Alert.findByIdAndUpdate(
alertId,
{ status: "ACTIVE" },
{ returnDocument: "after" }
).lean();
return res.status(200).json({ success: true, data: alert });
} catch (error) {
return respondError(res, "Failed to acknowledge alert", error);
}
};

const resolveAlert = async (req, res) => {
try {
const { alertId } = req.params;
const { reason = "Resolved by operator", notes = "", resolvedBy = "operator" } = req.body || {};
if (!mongoose.Types.ObjectId.isValid(alertId)) {
return res.status(400).json({ success: false, message: "Invalid alert id" });
}
const alert = await Alert.findByIdAndUpdate(
alertId,
{
status: "RESOLVED",
resolved_at: new Date(),
resolution_reason: String(reason),
resolution_notes: String(notes),
resolved_by: String(resolvedBy)
},
{ returnDocument: "after" }
).lean();
return res.status(200).json({ success: true, data: alert });
} catch (error) {
return respondError(res, "Failed to resolve alert", error);
}
};

module.exports = {
getAlerts,
getUserAlerts,
getActiveAlerts,
getAlertsByPriority,
getHealthScores,
getUserHealthScore,
getFleetMetrics,
getSitePerformance,
getSiteTrends,
getWatchlist,
acknowledgeAlert,
resolveAlert
};
