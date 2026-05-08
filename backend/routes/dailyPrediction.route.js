const express = require("express");
const DailyPrediction = require("../models/DailyPrediction");

const router = express.Router();

/**
 * GET /users/:userId/daily-predictions
 * Fetch 6-day prediction history (today + previous 5 days)
 * Returns predictions with predicted column and inverter real-time column (N/A for now)
 */
router.get("/:userId/daily-predictions", async (req, res) => {
	try {
		const { userId } = req.params;

		// Validate userId format
		if (!userId || userId.length !== 24) {
			return res.status(400).json({
				success: false,
				message: "Invalid user ID format"
			});
		}

		// Get today's date
		const today = new Date();
		const sixDaysAgo = new Date();
		sixDaysAgo.setDate(today.getDate() - 5);

		// Format dates for query (YYYY-MM-DD)
		const todayStr = today.toISOString().split("T")[0];
		const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];

		// Fetch predictions for the last 6 days (including today)
		const predictions = await DailyPrediction.find({
			userId: userId,
			date: {
				$gte: sixDaysAgoStr,
				$lte: todayStr
			}
		})
			.sort({ date: -1 })
			.lean();

		// Format response with two columns
		const formattedData = predictions.map((pred) => ({
			date: pred.date,
			predicted_kwh: parseFloat(pred.predicted_kwh.toFixed(2)),
			inverter_real_time_kwh: pred.inverter_real_time_kwh, // "N/A" for now
			peak_power_kw: parseFloat(pred.peak_power_kw.toFixed(2)),
			avg_temperature: parseFloat(pred.avg_temperature.toFixed(2)),
			avg_cloud_cover: parseFloat(pred.avg_cloud_cover.toFixed(2))
		}));

		res.status(200).json({
			success: true,
			data: formattedData,
			count: formattedData.length,
			message: "Daily predictions retrieved successfully"
		});
	} catch (err) {
		console.error("[Daily Predictions Route] Error:", err.message);
		res.status(500).json({
			success: false,
			message: "Failed to fetch daily predictions",
			error: err.message
		});
	}
});

/**
 * POST /users/:userId/daily-predictions/trigger
 * Manual trigger for testing the daily prediction fetch
 * (Optional - for debugging/testing purposes)
 */
router.post("/:userId/daily-predictions/trigger", async (req, res) => {
	try {
		const { userId } = req.params;

		// Validate userId format
		if (!userId || userId.length !== 24) {
			return res.status(400).json({
				success: false,
				message: "Invalid user ID format"
			});
		}

		// Import scheduler to trigger manually
		const { triggerDailyPredictionFetch } = require("../services/dailyPredictionScheduler");

		// Trigger the fetch
		await triggerDailyPredictionFetch();

		res.status(200).json({
			success: true,
			message: "Daily prediction fetch triggered successfully"
		});
	} catch (err) {
		console.error("[Daily Predictions Trigger] Error:", err.message);
		res.status(500).json({
			success: false,
			message: "Failed to trigger daily prediction fetch",
			error: err.message
		});
	}
});

module.exports = router;
