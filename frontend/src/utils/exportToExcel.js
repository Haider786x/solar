import ExcelJS from "exceljs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Emission & solar assumptions (sources: IEA grid emission factor; NREL peak sun hours average)
const CO2_KG_PER_KWH      = 0.82;  // avg grid CO₂ emission factor (kg CO₂ / kWh)
const KG_CO2_PER_TREE_PA  = 21;    // CO₂ absorbed per mature tree per year (kg)
const AVG_CAR_CO2_KG_PA   = 4600;  // avg car CO₂ emissions per year (kg)
const PEAK_SUN_HOURS       = 5;     // standard peak sun hours used for daily estimate

// --- Colour palette (emerald / blue) ---
const C = {
	emeraldDark:  "065F46",
	emeraldMid:   "059669",
	emeraldLight: "D1FAE5",
	blueDark:     "1E3A8A",
	blueMid:      "2563EB",
	blueLight:    "DBEAFE",
	slateLight:   "F8FAFC",
	white:        "FFFFFFFF",
	border:       "CBD5E1",
	textDark:     "0F172A",
};

// --- Reusable style helpers ---
const solidFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const thinBorder = () => ({
	top:    { style: "thin", color: { argb: C.border } },
	left:   { style: "thin", color: { argb: C.border } },
	bottom: { style: "thin", color: { argb: C.border } },
	right:  { style: "thin", color: { argb: C.border } },
});

function styleTitle(cell, text) {
	cell.value = text;
	cell.fill  = solidFill(C.emeraldDark);
	cell.font  = { bold: true, size: 16, color: { argb: C.white } };
	cell.alignment = { vertical: "middle", horizontal: "center" };
}

function styleSectionHeader(cell, text, bgArgb = C.blueLight, fgArgb = C.blueDark) {
	cell.value = text;
	cell.fill  = solidFill(bgArgb);
	cell.font  = { bold: true, size: 11, color: { argb: fgArgb } };
	cell.alignment = { vertical: "middle", horizontal: "left" };
	cell.border = { bottom: { style: "medium", color: { argb: C.blueMid } } };
}

function styleColHeader(cell) {
	cell.fill   = solidFill(C.emeraldMid);
	cell.font   = { bold: true, size: 10, color: { argb: C.white } };
	cell.alignment = { vertical: "middle", horizontal: "center" };
	cell.border = thinBorder();
}

function styleDataCell(cell, align = "left", isAlt = false) {
	if (isAlt) cell.fill = solidFill("F0FDF4"); // emerald-50
	cell.font   = { size: 10, color: { argb: C.textDark } };
	cell.alignment = { vertical: "middle", horizontal: align };
	cell.border = thinBorder();
}

function styleLabelCell(cell) {
	cell.fill  = solidFill(C.slateLight);
	cell.font  = { bold: true, size: 10, color: { argb: C.textDark } };
	cell.alignment = { vertical: "middle", horizontal: "left" };
	cell.border = thinBorder();
}

// --- Download helper ---
async function downloadWorkbook(wb, filename) {
	const buffer = await wb.xlsx.writeBuffer();
	const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
	const url    = URL.createObjectURL(blob);
	const a      = document.createElement("a");
	a.href       = url;
	a.download   = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ============================================================
// SHEET 1 – Executive Summary
// ============================================================
function addSummarySheet(wb, user, report) {
	const ws = wb.addWorksheet("Executive Summary");
	ws.columns = [
		{ key: "label", width: 30 },
		{ key: "value", width: 35 },
	];

	// Title
	ws.mergeCells("A1:B1");
	styleTitle(ws.getCell("A1"), "SOLAR ENERGY REPORT");
	ws.getRow(1).height = 40;

	// Generated date
	ws.mergeCells("A2:B2");
	const dateCell = ws.getCell("A2");
	dateCell.value     = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
	dateCell.fill      = solidFill(C.emeraldLight);
	dateCell.font      = { italic: true, size: 10, color: { argb: C.emeraldDark } };
	dateCell.alignment = { horizontal: "center" };

	ws.addRow([]);

	// Section header
	ws.mergeCells("A4:B4");
	styleSectionHeader(ws.getCell("A4"), "KEY PERFORMANCE METRICS", C.blueLight, C.blueDark);
	ws.getRow(4).height = 22;

	const metrics = [
		["Annual Energy Output",   `${(report?.annual_energy_kwh ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`],
		["Performance Ratio",      `${((report?.performance_ratio ?? 0) * 100).toFixed(1)} %`],
		["System Capacity",        `${user?.systemCapacity ?? "–"} kW`],
		["Location (Lat / Lon)",   `${user?.location?.latitude ?? "–"} / ${user?.location?.longitude ?? "–"}`],
		["Forecast Days Available",String(report?.forecast_7_days?.length ?? 0)],
		["CO₂ Savings (Est.)",     `${((report?.annual_energy_kwh ?? 0) * 0.82).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg`],
		["Trees Equivalent (Est.)",`${(((report?.annual_energy_kwh ?? 0) * 0.82) / 21).toFixed(1)} trees`],
	];

	metrics.forEach(([label, value], i) => {
		const row = ws.addRow([label, value]);
		row.height = 20;
		styleLabelCell(row.getCell(1));
		styleDataCell(row.getCell(2), "right", i % 2 === 0);
	});
}

// ============================================================
// SHEET 2 – User & System Details
// ============================================================
function addUserDetailsSheet(wb, user) {
	const ws = wb.addWorksheet("User & System Details");
	ws.columns = [
		{ key: "label", width: 28 },
		{ key: "value", width: 40 },
	];

	ws.mergeCells("A1:B1");
	styleTitle(ws.getCell("A1"), "USER & SYSTEM DETAILS");
	ws.getRow(1).height = 36;

	ws.addRow([]);

	// User Information
	ws.mergeCells("A3:B3");
	styleSectionHeader(ws.getCell("A3"), "USER INFORMATION");
	ws.getRow(3).height = 22;

	const userFields = [
		["Full Name",    user?.name        ?? "–"],
		["Email Address",user?.email       ?? "–"],
		["Phone Number", user?.phoneNumber ?? "–"],
	];
	userFields.forEach(([label, value], i) => {
		const row = ws.addRow([label, value]);
		row.height = 20;
		styleLabelCell(row.getCell(1));
		styleDataCell(row.getCell(2), "left", i % 2 === 0);
	});

	ws.addRow([]);

	// System Configuration
	const sysRow = ws.addRow([]);
	ws.mergeCells(`A${sysRow.number}:B${sysRow.number}`);
	styleSectionHeader(ws.getCell(`A${sysRow.number}`), "SYSTEM CONFIGURATION", C.emeraldLight, C.emeraldDark);
	sysRow.height = 22;

	const sysFields = [
		["System Capacity (kW)",  user?.systemCapacity  ?? "–"],
		["Tilt Angle (deg)",      user?.tiltDeg         ?? "–"],
		["Azimuth Angle (deg)",   user?.azimuthDeg      ?? "–"],
		["Shading Factor",        user?.shadingFactor   ?? "–"],
		["Latitude",              user?.location?.latitude  ?? "–"],
		["Longitude",             user?.location?.longitude ?? "–"],
	];
	sysFields.forEach(([label, value], i) => {
		const row = ws.addRow([label, value]);
		row.height = 20;
		styleLabelCell(row.getCell(1));
		styleDataCell(row.getCell(2), "left", i % 2 === 0);
	});
}

// ============================================================
// SHEET 3 – Monthly Energy Breakdown
// ============================================================
function addMonthlySheet(wb, report) {
	const ws = wb.addWorksheet("Monthly Energy Breakdown");
	ws.columns = [
		{ key: "month",   width: 18 },
		{ key: "energy",  width: 22 },
		{ key: "percent", width: 20 },
	];

	ws.mergeCells("A1:C1");
	styleTitle(ws.getCell("A1"), "MONTHLY ENERGY BREAKDOWN");
	ws.getRow(1).height = 36;

	ws.addRow([]);

	// Column headers
	const headerRow = ws.addRow(["Month", "Energy (kWh)", "% of Annual"]);
	headerRow.height = 22;
	["A", "B", "C"].forEach((col) => styleColHeader(ws.getCell(`${col}${headerRow.number}`)));

	const monthlyRaw = report?.monthly_energy_kwh;
	const entries = [];
	if (Array.isArray(monthlyRaw)) {
		monthlyRaw.forEach((val, idx) => entries.push([MONTHS[idx] ?? `Month ${idx + 1}`, Number(val) || 0]));
	} else if (monthlyRaw && typeof monthlyRaw === "object") {
		Object.entries(monthlyRaw).forEach(([key, val]) => entries.push([key, Number(val) || 0]));
	}

	const total = entries.reduce((s, [, v]) => s + v, 0);

	entries.forEach(([month, energy], i) => {
		const pct = total > 0 ? ((energy / total) * 100).toFixed(1) : "0.0";
		const row = ws.addRow([month, energy.toFixed(2), `${pct}%`]);
		row.height = 20;
		styleDataCell(row.getCell(1), "left",  i % 2 === 0);
		styleDataCell(row.getCell(2), "right", i % 2 === 0);
		styleDataCell(row.getCell(3), "right", i % 2 === 0);
		row.getCell(2).numFmt = "#,##0.00";
	});

	if (entries.length) {
		const totalRow = ws.addRow(["TOTAL", total.toFixed(2), "100.0%"]);
		totalRow.height = 22;
		["A", "B", "C"].forEach((col) => {
			const cell = totalRow.getCell(col);
			cell.fill   = solidFill(C.emeraldMid);
			cell.font   = { bold: true, size: 10, color: { argb: C.white } };
			cell.border = thinBorder();
			cell.alignment = { horizontal: col === "A" ? "left" : "right", vertical: "middle" };
		});
		totalRow.getCell("B").numFmt = "#,##0.00";
	}
}

// ============================================================
// SHEET 4 – 7-Day Forecast
// ============================================================
function addForecastSheet(wb, report) {
	const ws = wb.addWorksheet("7-Day Forecast");
	ws.columns = [
		{ key: "date",    width: 18 },
		{ key: "kwh",     width: 22 },
		{ key: "cloud",   width: 20 },
		{ key: "temp",    width: 24 },
	];

	ws.mergeCells("A1:D1");
	styleTitle(ws.getCell("A1"), "7-DAY SOLAR FORECAST");
	ws.getRow(1).height = 36;

	ws.addRow([]);

	const headerRow = ws.addRow(["Date", "Predicted (kWh)", "Cloud Cover (%)", "Temperature (°C)"]);
	headerRow.height = 22;
	["A", "B", "C", "D"].forEach((col) => styleColHeader(ws.getCell(`${col}${headerRow.number}`)));

	const forecast = report?.forecast_7_days;
	if (forecast?.length) {
		forecast.forEach((item, i) => {
			const row = ws.addRow([
				item.date ?? "",
				Number((item.predicted_kwh ?? 0).toFixed(2)),
				item.cloud_cover ?? "",
				item.temperature ?? "",
			]);
			row.height = 20;
			styleDataCell(row.getCell(1), "center", i % 2 === 0);
			styleDataCell(row.getCell(2), "right",  i % 2 === 0);
			styleDataCell(row.getCell(3), "right",  i % 2 === 0);
			styleDataCell(row.getCell(4), "right",  i % 2 === 0);
			row.getCell(2).numFmt = "#,##0.00";
		});
	} else {
		ws.mergeCells(`A4:D4`);
		const noDataCell = ws.getCell("A4");
		noDataCell.value     = "No forecast data available for this report.";
		noDataCell.fill      = solidFill(C.slateLight);
		noDataCell.font      = { italic: true, size: 10, color: { argb: "94A3B8" } };
		noDataCell.alignment = { horizontal: "center", vertical: "middle" };
		ws.getRow(4).height  = 24;
	}
}

// ============================================================
// SHEET 5 – Savings & Environmental Impact
// ============================================================
function addSavingsSheet(wb, user, report) {
	const ws = wb.addWorksheet("Savings & Environmental Impact");
	ws.columns = [
		{ key: "label", width: 34 },
		{ key: "value", width: 30 },
	];

	ws.mergeCells("A1:B1");
	styleTitle(ws.getCell("A1"), "SAVINGS & ENVIRONMENTAL IMPACT");
	ws.getRow(1).height = 36;

	ws.addRow([]);

	// Environmental impact
	ws.mergeCells("A3:B3");
	styleSectionHeader(ws.getCell("A3"), "ENVIRONMENTAL IMPACT", C.emeraldLight, C.emeraldDark);
	ws.getRow(3).height = 22;

	const annualKwh  = report?.annual_energy_kwh ?? 0;
	const co2Saved   = annualKwh * CO2_KG_PER_KWH;
	const trees      = co2Saved / KG_CO2_PER_TREE_PA;
	const carDays    = (co2Saved / AVG_CAR_CO2_KG_PA) * 365;

	const envFields = [
		["Annual Energy Generated (kWh)",  annualKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })],
		["CO₂ Emissions Saved (kg/year)",  co2Saved.toLocaleString("en-US", { maximumFractionDigits: 1 })],
		["Equivalent Trees Planted",       trees.toFixed(1)],
		["Car-free Driving Days Equivalent", carDays.toFixed(1)],
	];
	envFields.forEach(([label, value], i) => {
		const row = ws.addRow([label, value]);
		row.height = 20;
		styleLabelCell(row.getCell(1));
		styleDataCell(row.getCell(2), "right", i % 2 === 0);
	});

	ws.addRow([]);

	// System summary
	const sysSummaryRow = ws.addRow([]);
	ws.mergeCells(`A${sysSummaryRow.number}:B${sysSummaryRow.number}`);
	styleSectionHeader(ws.getCell(`A${sysSummaryRow.number}`), "SYSTEM SUMMARY", C.blueLight, C.blueDark);
	sysSummaryRow.height = 22;

	const capacity    = Number(user?.systemCapacity ?? 0);
	const perfRatio   = report?.performance_ratio ?? 0;
	const estDailyKwh = capacity * PEAK_SUN_HOURS * perfRatio;

	const sysFields = [
		["Installed Capacity (kW)",       capacity > 0 ? capacity.toFixed(2) : "–"],
		["Performance Ratio",             perfRatio > 0 ? `${(perfRatio * 100).toFixed(1)} %` : "–"],
		["Est. Daily Generation (kWh)",   estDailyKwh > 0 ? estDailyKwh.toFixed(2) : "–"],
		["Est. Annual Generation (kWh)",  annualKwh > 0 ? annualKwh.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "–"],
	];
	sysFields.forEach(([label, value], i) => {
		const row = ws.addRow([label, value]);
		row.height = 20;
		styleLabelCell(row.getCell(1));
		styleDataCell(row.getCell(2), "right", i % 2 === 0);
	});

	ws.addRow([]);

	// Disclaimer
	const noteRow = ws.addRow([]);
	ws.mergeCells(`A${noteRow.number}:B${noteRow.number}`);
	const noteCell = ws.getCell(`A${noteRow.number}`);
	noteCell.value     = `Note: Environmental impact figures are estimates based on average grid emission factors (${CO2_KG_PER_KWH} kg CO₂/kWh).`;
	noteCell.font      = { italic: true, size: 9, color: { argb: "64748B" } };
	noteCell.alignment = { wrapText: true };
	ws.getRow(noteRow.number).height = 28;
}

// ============================================================
// MAIN export function
// ============================================================
export const exportReportToExcel = async (user, report) => {
	const wb = new ExcelJS.Workbook();
	wb.creator  = "Solar Report System";
	wb.created  = new Date();
	wb.modified = new Date();

	addSummarySheet(wb, user, report);
	addUserDetailsSheet(wb, user);
	addMonthlySheet(wb, report);
	addForecastSheet(wb, report);
	addSavingsSheet(wb, user, report);

	const date     = new Date().toISOString().slice(0, 10);
	const safeName = (user?.name ?? "User").replace(/\s+/g, "_");
	await downloadWorkbook(wb, `Solar_Report_${safeName}_${date}.xlsx`);
};
