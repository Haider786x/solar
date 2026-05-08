const cron = require("node-cron");
const DailyPrediction = require("../models/DailyPrediction");
const User = require("../models/User");

const AIML_BASE_URL = process.env.AIML_BASE_URL || "http://localhost:8000";

/**
 * Fetch daily prediction from AIML API and store in database
 * Keeps rolling 6-day window (today + previous 5 days)
 */
async function fetchAndStoreDailyPredictions() {
	try {
		console.log(`[Daily Prediction] Starting fetch at ${new Date().toISOString()}`);

		// Get all users
		const users = await User.find({});

		if (!users.length) {
			console.log("[Daily Prediction] No users found");
			return;
		}

		const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

		for (const user of users) {
			try {
				// Skip if user doesn't have required fields
				if (!user.location || !user.systemCapacity || !user.tiltDeg || !user.azimuthDeg) {
					console.log(`[Daily Prediction] Skipping user ${user._id} - missing location/system data`);
					continue;
				}

				const { latitude, longitude } = user.location;
				const { systemCapacity, tiltDeg, azimuthDeg } = user;

				// Call AIML /predict-today endpoint
				const aimlUrl = new URL(`${AIML_BASE_URL}/predict-today`);
				aimlUrl.searchParams.append("lat", latitude);
				aimlUrl.searchParams.append("lon", longitude);
				aimlUrl.searchParams.append("capacity_kw", systemCapacity);
				aimlUrl.searchParams.append("tilt", tiltDeg);
				aimlUrl.searchParams.append("azimuth", azimuthDeg);

				const response = await fetch(aimlUrl.toString(), { timeout: 30000 });

				if (!response.ok) {
					throw new Error(`AIML API returned ${response.status}`);
				}

				const prediction = await response.json();

				// Store prediction
				await DailyPrediction.findOneAndUpdate(
					{ userId: user._id, date: today },
					{
						userId: user._id,
						date: today,
						predicted_kwh: prediction.daily_energy_kwh || 0,
						peak_power_kw: prediction.peak_power_kw || 0,
						avg_temperature: prediction.avg_temperature || 0,
						avg_cloud_cover: prediction.avg_cloud_cover || 0,
						inverter_real_time_kwh: "N/A"
					},
					{ upsert: true, new: true }
				);

				console.log(`[Daily Prediction] Stored prediction for user ${user._id} on ${today}`);

				// Delete predictions older than 6 days
				const sixDaysAgo = new Date();
				sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
				const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];

				await DailyPrediction.deleteMany({
					userId: user._id,
					date: { $lt: sixDaysAgoStr }
				});

				console.log(`[Daily Prediction] Cleaned old predictions for user ${user._id} before ${sixDaysAgoStr}`);
			} catch (err) {
				console.error(`[Daily Prediction] Error processing user ${user._id}:`, err.message);
				// Continue with next user on error
			}
		}

		console.log("[Daily Prediction] Batch fetch completed successfully");
	} catch (err) {
		console.error("[Daily Prediction] Scheduler error:", err.message);
	}
}

/**
 * Initialize the daily prediction scheduler
 * Runs every day at 7 PM (19:00) in the server's timezone
 */
function initializeDailyPredictionScheduler() {
	// Schedule for 7 PM (19:00) every day
	const job = cron.schedule("0 19 * * *", fetchAndStoreDailyPredictions, {
		scheduled: true,
		timezone: "UTC"
	});

	console.log("[Daily Prediction] Scheduler initialized - runs daily at 7 PM UTC");

	// Return job handle for manual testing/control
	return job;
}

/**
 * Manual trigger for testing (can be called from route)
 */
async function triggerDailyPredictionFetch() {
	console.log("[Daily Prediction] Manual trigger initiated");
	await fetchAndStoreDailyPredictions();
}

module.exports = {
	initializeDailyPredictionScheduler,
	triggerDailyPredictionFetch,
	fetchAndStoreDailyPredictions
};
