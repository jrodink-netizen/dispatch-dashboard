import { useEffect, useMemo, useState, createContext, useContext } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";

// --- Thema Configuratie ---
const lightTheme = {
  bg: "#f3f4f6",
  cardBg: "white",
  textMain: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  inputBg: "white",
  inputBorder: "#d1d5db",
  primaryBtnBg: "#111827",
  primaryBtnText: "white",
  secondaryBtnBg: "white",
  secondaryBtnText: "#111827",
  rowSelected: "#eff6ff",
  rowSelectedBorder: "#bfdbfe",
  tableHeaderBg: "#f9fafb",
  shadow: "0 10px 24px rgba(17,24,39,0.05)",
  chartBar: "#3b82f6",
  chartBg: "#f1f5f9",
  isDark: false,
};

const darkTheme = {
  bg: "#0f172a",
  cardBg: "#1e293b",
  textMain: "#f8fafc",
  textMuted: "#94a3b8",
  border: "#334155",
  inputBg: "#0f172a",
  inputBorder: "#475569",
  primaryBtnBg: "#3b82f6",
  primaryBtnText: "white",
  secondaryBtnBg: "#1e293b",
  secondaryBtnText: "#f8fafc",
  rowSelected: "#1e3a8a",
  rowSelectedBorder: "#3b82f6",
  tableHeaderBg: "#0f172a",
  shadow: "0 10px 24px rgba(0,0,0,0.3)",
  chartBar: "#60a5fa",
  chartBg: "#334155",
  isDark: true,
};

const ThemeContext = createContext();
const rideStatuses = ["Gepland", "Bevestigd", "Onderweg", "Afgerond"];
const driverOptions = ["Erwin", "Julian", "Gerben", "Hans", "Fiona"];

// --- Helper Functies ---
function useWindowWidth() {
  const getWidth = () => (typeof window !== "undefined" ? window.innerWidth : 1200);
  const [windowWidth, setWindowWidth] = useState(getWidth);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(getWidth());
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowWidth;
}

function sortRides(list) {
  return [...list].sort((a, b) => {
    const dateCompare = a.ride_date.localeCompare(b.ride_date);
    if (dateCompare !== 0) return dateCompare;
    return a.departure_time.localeCompare(b.departure_time);
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function addMinutesToTimeString(timeString, minutesToAdd) {
  if (!timeString || !timeString.includes(":")) return "";
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(
    normalizedMinutes % 60
  ).padStart(2, "0")}`;
}

function isTimeOnTime(plannedTime, actualTime, graceMinutes = 15) {
  if (!plannedTime || !actualTime) return false;
  const [pH, pM] = plannedTime.split(":").map(Number);
  const [aH, aM] = actualTime.split(":").map(Number);
  const pTotal = pH * 60 + pM;
  const aTotal = aH * 60 + aM;
  return aTotal <= pTotal + graceMinutes;
}

function getMapUrl(address) {
  if (!address) return "#";
  const encodedAddress = encodeURIComponent(address);
  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);

  if (isApple) {
    return `http://maps.apple.com/?q=${encodedAddress}`;
  } else {
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }
}

function getRideStatusStyle(status, isDark) {
  if (isDark) {
    switch (status) {
      case "Gepland": return { background: "rgba(124, 58, 237, 0.2)", color: "#c4b5fd", border: "1px solid rgba(124, 58, 237, 0.5)" };
      case "Bevestigd": return { background: "rgba(22, 101, 52, 0.3)", color: "#86efac", border: "1px solid rgba(22, 101, 52, 0.6)" };
      case "Onderweg": return { background: "rgba(29, 78, 216, 0.3)", color: "#93c5fd", border: "1px solid rgba(29, 78, 216, 0.6)" };
      case "Afgerond": return { background: "rgba(55, 65, 81, 0.5)", color: "#d1d5db", border: "1px solid rgba(55, 65, 81, 0.8)" };
      default: return { background: "#334155", color: "#f8fafc", border: "1px solid #475569" };
    }
  } else {
    switch (status) {
      case "Gepland": return { background: "#f3e8ff", color: "#7c3aed", border: "1px solid #ddd6fe" };
      case "Bevestigd": return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
      case "Onderweg": return { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" };
      case "Afgerond": return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
      default: return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
    }
  }
}

function exportCompletedRidesToExcel(rides) {
  const completedRides = sortRides(rides).filter((ride) => ride.status === "Afgerond");

  if (completedRides.length === 0) {
    alert("Er zijn geen afgeronde ritten om te exporteren.");
    return;
  }

  const exportData = completedRides.map((ride) => {
    const onTime = ride.arrival_time && ride.actual_arrival_time ? isTimeOnTime(ride.arrival_time, ride.actual_arrival_time) ? "Ja" : "Nee" : "";
    return {
      ID: ride.id ?? "",
      Datum: ride.ride_date ?? "",
      Chauffeur: ride.driver_name ?? "",
      Vertrektijd: ride.departure_time ?? "",
      "Geplande aankomst": ride.arrival_time ?? "",
      "Echte aankomst": ride.actual_arrival_time ?? "",
      "Van locatie": ride.pickup_location ?? "",
      "Naar locatie": ride.delivery_location ?? "",
      "Kenteken/Lading": ride.cargo ?? "",
      Notities: ride.notes ?? "",
      Status: ride.status ?? "",
      "Op tijd": onTime,
      "Werkkaart": ride.workcard_printed ? "Geprint" : "Nee"
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Afgeronde ritten");

  const columnWidths = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  worksheet["!cols"] = columnWidths;

  const today = new Date();
  const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `afgeronde-ritten-${fileDate}.xlsx`);
}

function exportRideToWord(ride) {
  if (!ride) return;

  const datum = new Date(ride.ride_date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const notities = ride.notes ? ride.notes.replace(/\n/g, '<br/>') : "Geen verdere bijzonderheden.";

  const htmlTemplate = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Werkkaart</title>
      <style>
        @page { margin: 2cm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
        .header { text-align: center; border-bottom: 3px solid #111827; padding-bottom: 10px; margin-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
        .subtitle { font-size: 14px; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; }
        .section-title { font-size: 16px; font-weight: bold; color: #111827; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
        th { background-color: #f3f4f6; width: 35%; color: #374151; font-weight: bold; }
        .notes-box { border: 1px solid #d1d5db; padding: 15px; background-color: #f9fafb; min-height: 120px; font-size: 14px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class='header'>
        <div class='logo'>TYREPOINT</div>
        <div class='subtitle'>Transport Werkkaart</div>
      </div>
      
      <div class='section-title'>Algemene Gegevens</div>
      <table>
        <tr><th>Datum</th><td>${datum}</td></tr>
        <tr><th>Chauffeur</th><td><strong>${ride.driver_name}</strong></td></tr>
      </table>

      <div class='section-title'>Ritinformatie & Locaties</div>
      <table>
        <tr><th>Gepland Vertrek</th><td>${ride.departure_time || "--:--"}</td></tr>
        <tr><th>Ophaallocatie (Van)</th><td style="font-size: 15px;"><strong>${ride.pickup_location || "Niet ingevuld"}</strong></td></tr>
        <tr><th>Geplande Aankomst</th><td>${ride.arrival_time || "--:--"}</td></tr>
        <tr><th>Afleverlocatie (Naar)</th><td style="font-size: 15px;"><strong>${ride.delivery_location || "Niet ingevuld"}</strong></td></tr>
      </table>

      <div class='section-title'>Vracht & Details</div>
      <table>
        <tr><th>Kenteken / Lading</th><td>${ride.cargo || "Geen specifieke vrachtgegevens vermeld"}</td></tr>
      </table>
      
      <div class='section-title'>Instructies / Notities</div>
      <div class='notes-box'>
        ${notities}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlTemplate], { type: 'application/msword' });
  const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(htmlTemplate);
  const filename = `Werkkaart_${ride.driver_name}_${ride.ride_date}.doc`;
  
  const downloadLink = document.createElement("a");
  document.body.appendChild(downloadLink);
  
  if (navigator.msSaveOrOpenBlob) {
    navigator.msSaveOrOpenBlob(blob, filename);
  } else {
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.click();
  }
  document.body.removeChild(downloadLink);
}

// --- Dynamische Stijl Functies ---
const getLabelStyle = (theme) => ({
  display: "flex", flexDirection: "column", gap: 6, color: theme.textMain, fontSize: 13, fontWeight: 700, transition: "color 0.3s ease",
});

const getInputStyle = (theme) => ({
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, fontSize: 14, outline: "none", color: theme.textMain, fontFamily: "Arial, sans-serif", transition: "all 0.3s ease",
});

const getPrimaryButtonStyle = (theme) => ({
  background: theme.primaryBtnBg, color: theme.primaryBtnText, border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.3s ease",
});

const getSecondaryButtonStyle = (theme) => ({
  background: theme.secondaryBtnBg, color: theme.secondaryBtnText, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.3s ease",
});

const getTabStyle = (isActive, theme) => ({
  padding: "12px 20px", fontSize: 15, fontWeight: 800, color: isActive ? theme.textMain : theme.textMuted, borderBottom: isActive ? `3px solid ${theme.primaryBtnBg}` : "3px solid transparent", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none", cursor: "pointer", transition: "all 0.3s ease",
});

const darkGhostButtonStyle = {
  background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.3s ease",
};

// --- Componenten ---
function DarkModeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  return (
    <button onClick={toggleTheme} title="Wissel Dark Mode" style={{ width: 56, height: 30, borderRadius: 30, background: theme.isDark ? "#334155" : "rgba(255,255,255,0.2)", border: theme.isDark ? "1px solid #475569" : "1px solid rgba(255,255,255,0.4)", position: "relative", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", transition: "all 0.3s ease" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "white", position: "absolute", left: theme.isDark ? 28 : 4, transition: "left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", fontSize: 14 }}>
        {theme.isDark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}

function Badge({ children, style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, transition: "all 0.3s ease", ...style }}>
      {children}
    </span>
  );
}

function StatCard({ title, value, sub }) {
  const { theme } = useContext(ThemeContext);
  return (
    <div style={{ background: theme.cardBg, borderRadius: 22, padding: 20, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, transition: "all 0.3s ease", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8, transition: "color 0.3s ease" }}>{title}</div>
      <div style={{ color: theme.textMain, fontWeight: 900, fontSize: 30, transition: "color 0.3s ease" }}>{value}</div>
      <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 6, transition: "color 0.3s ease" }}>{sub}</div>
    </div>
  );
}

// ---------------- UITGEBREIDE STATISTIEKEN COMPONENT MET CAPACITEIT ----------------
function StatisticsDashboard({ rides }) {
  const { theme } = useContext(ThemeContext);
  const isMobile = useWindowWidth() < 700;
  
  // --- NIEUWE CAPACITEIT STATEN ---
  const [activeDrivers, setActiveDrivers] = useState(2); // Standaard op 2 gezet
  const [maxRidesPerDriver, setMaxRidesPerDriver] = useState(8);
  const dailyCapacity = activeDrivers * maxRidesPerDriver;

  const totalRides = rides.length;
  const completedRides = rides.filter((r) => r.status === "Afgerond").length;
  const completionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 100) : 0;
  
  const otpRides = rides.filter((r) => r.status === "Afgerond" && r.arrival_time && r.actual_arrival_time);
  const onTimeCount = otpRides.filter((r) => isTimeOnTime(r.arrival_time, r.actual_arrival_time)).length;
  const otp = otpRides.length > 0 ? Math.round((onTimeCount / otpRides.length) * 100) : 0;
  const dashArray = `${otp}, 100`;

  const driverColors = {
    "Erwin": "#ef4444",   // Rood
    "Julian": "#3b82f6",  // Blauw
    "Gerben": "#10b981",  // Groen
    "Hans": "#f59e0b",    // Oranje
    "Fiona": "#8b5cf6"    // Paars
  };

  const routes = rides.filter(r => r.pickup_location && r.delivery_location).map(r => `${r.pickup_location} → ${r.delivery_location}`);
  const routeCounts = {};
  routes.forEach(r => routeCounts[r] = (routeCounts[r] || 0) + 1);
  const popularRoute = Object.keys(routeCounts).sort((a,b) => routeCounts[b] - routeCounts[a])[0] || "Onvoldoende data";
  const popularRouteCount = routeCounts[popularRoute] || 0;

  const fourWeeksDates = [];
  const current = new Date();
  for (let i = -14; i <= 14; i++) {
    const d = new Date(current);
    d.setDate(current.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    fourWeeksDates.push(`${yyyy}-${mm}-${dd}`);
  }
  const todayString = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  
  const dates = [...new Set(rides.map(r => r.ride_date))].sort();
  const dateCounts = dates.map(date => rides.filter(r => r.ride_date === date).length);
  const maxPerDay = Math.max(...dateCounts, 0);
  const busiestDayIndex = dateCounts.indexOf(maxPerDay);
  const busiestDay = dates[busiestDayIndex] ? formatDate(dates[busiestDayIndex]) : "N/A";
  
  const maxRides4Weeks = Math.max(...fourWeeksDates.map(date => rides.filter(r => r.ride_date === date).length), 0);

  // --- SLIMME VOORSPELLINGS LOGICA (Laatste 6 weken) ---
  const getDayEfficiency = (dayName) => {
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const sixWeeksAgoStr = sixWeeksAgo.toISOString().slice(0, 10);

    const historicalRides = rides.filter(r => {
      const d = new Date(r.ride_date);
      const day = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
      return day === dayName && r.ride_date < todayString && r.ride_date >= sixWeeksAgoStr;
    });
    
    const uniqueDates = [...new Set(historicalRides.map(r => r.ride_date))];
    if (uniqueDates.length === 0) return 0;
    return Math.round(historicalRides.length / uniqueDates.length);
  };

  const predictions = useMemo(() => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames.reduce((acc, name) => {
      acc[name] = getDayEfficiency(name);
      return acc;
    }, {});
  }, [rides, todayString]);

  const maxPrediction = Math.max(...Object.values(predictions), 0);
  
  // Zorg dat de grafiek hoog genoeg is om de dagcapaciteit óók te tonen
  const chartYMax = Math.max(maxPerDay, maxRides4Weeks, maxPrediction, dailyCapacity, 10);

  // --- CAPACITEIT TEKORT ALARM ---
  const next7Days = fourWeeksDates.filter(d => d > todayString).slice(0, 7);
  const predictionAlert = useMemo(() => {
    let highestDeficit = 0;
    let alertData = null;

    next7Days.forEach(date => {
      const dayNameEn = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(date));
      const prediction = predictions[dayNameEn] || 0;
      const currentCount = rides.filter(r => r.ride_date === date).length;
      
      const expectedTotal = Math.max(prediction, currentCount);

      if (expectedTotal > dailyCapacity) {
        const deficit = expectedTotal - dailyCapacity;
        if (deficit > highestDeficit) {
          highestDeficit = deficit;
          alertData = {
            day: new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(new Date(date)),
            date: date,
            expected: expectedTotal,
            capacity: dailyCapacity,
            deficit: deficit,
            driversShort: Math.ceil(deficit / maxRidesPerDriver) // Aantal chauffeurs dat je mist
          };
        }
      }
    });
    return alertData;
  }, [predictions, next7Days, dailyCapacity, maxRidesPerDriver, rides]);
  // ----------------------------------------

  const detailedDriverStats = driverOptions.map(driver => {
    const dRides = rides.filter(r => r.driver_name === driver);
    const dTotal = dRides.length;
    const dCompleted = dRides.filter(r => r.status === "Afgerond").length;
    
    const dOtpRides = dRides.filter(r => r.status === "Afgerond" && r.arrival_time && r.actual_arrival_time);
    const dOnTime = dOtpRides.filter(r => isTimeOnTime(r.arrival_time, r.actual_arrival_time)).length;
    const dOtp = dOtpRides.length > 0 ? Math.round((dOnTime / dOtpRides.length) * 100) : 0;

    return { name: driver, total: dTotal, completed: dCompleted, otp: dOtp, otpCount: dOtpRides.length };
  });

  const statusCounts = rideStatuses.map((status) => ({ status, count: rides.filter((r) => r.status === status).length }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.5s ease" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, color: theme.textMain }}>Dashboard Overzicht</h2>
        <button type="button" onClick={() => exportCompletedRidesToExcel(rides)} style={getSecondaryButtonStyle(theme)}>Exporteer Data (Excel)</button>
      </div>

      {/* CAPACITEITS-INSTELLINGEN */}
      <div style={{ background: theme.cardBg, borderRadius: 20, border: `1px solid ${theme.border}`, padding: 20, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", boxShadow: theme.shadow }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ ...getLabelStyle(theme), marginBottom: 6 }}>Werkende chauffeurs (per dag)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="number" min="1" max="20" value={activeDrivers} onChange={(e) => setActiveDrivers(Number(e.target.value))} style={{ ...getInputStyle(theme), width: 80 }} />
            <span style={{ color: theme.textMuted, fontSize: 14 }}>personen</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ ...getLabelStyle(theme), marginBottom: 6 }}>Max ritten per chauffeur</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="number" min="1" max="50" value={maxRidesPerDriver} onChange={(e) => setMaxRidesPerDriver(Number(e.target.value))} style={{ ...getInputStyle(theme), width: 80 }} />
            <span style={{ color: theme.textMuted, fontSize: 14 }}>ritten</span>
          </div>
        </div>
        <div style={{ background: theme.isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff", border: `1px solid ${theme.isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe"}`, padding: "12px 20px", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 160 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.isDark ? "#93c5fd" : "#1d4ed8", textTransform: "uppercase", letterSpacing: 1 }}>Ploeg Plafond</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.isDark ? "#60a5fa" : "#2563eb" }}>{dailyCapacity} <span style={{ fontSize: 14, fontWeight: 700 }}>ritten</span></div>
        </div>
      </div>

      {/* OVERCAPACITEIT ALARM */}
      {predictionAlert && (
        <div style={{ background: theme.isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2", border: `1px solid ${theme.isDark ? "rgba(239, 68, 68, 0.4)" : "#fecaca"}`, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, animation: "fadeIn 0.5s ease" }}>
          <div style={{ fontSize: 28 }}>🚨</div>
          <div>
            <div style={{ color: theme.isDark ? "#fca5a5" : "#b91c1c", fontWeight: 800, fontSize: 15 }}>Capaciteitstekort Verwacht</div>
            <div style={{ color: theme.textMain, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
              Op <strong><span style={{ textTransform: "capitalize" }}>{predictionAlert.day}</span> ({formatDate(predictionAlert.date).split(" ")[0]} {formatDate(predictionAlert.date).split(" ")[1]})</strong> worden <strong>{predictionAlert.expected} ritten</strong> verwacht, maar je limiet staat op {predictionAlert.capacity}. Je komt waarschijnlijk <strong>{predictionAlert.driversShort} chauffeur(s)</strong> tekort!
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
        <StatCard title="Totaal Ritten/Auto's" value={totalRides} sub="Actief gepland in het systeem" />
        <StatCard title="Voltooiingspercentage" value={`${completionRate}%`} sub={`${completedRides} van de ${totalRides} afgerond`} />
        
        <div style={{ background: theme.cardBg, borderRadius: 22, padding: 20, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s ease" }}>
          <div>
            <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8 }}>On-Time Performance</div>
            <div style={{ color: theme.textMain, fontWeight: 900, fontSize: 30 }}>{otp}%</div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 6, maxWidth: 140 }}>
              {otpRides.length > 0 ? `Gemeten over ${otpRides.length} ritten` : "Onvoldoende data"}
            </div>
          </div>
          <div style={{ position: "relative", width: 70, height: 70 }}>
            <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={theme.chartBg} strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={otp >= 90 ? "#10b981" : otp >= 75 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={dashArray} style={{ transition: "stroke-dasharray 1s ease-out, stroke 1s ease" }} />
            </svg>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
        <StatCard title="Populairste Route" value={popularRoute} sub={popularRouteCount > 0 ? `${popularRouteCount} keer gereden` : "Geen routes gevonden"} />
        <StatCard title="Drukste Planningsdag" value={busiestDay} sub={maxPerDay > 0 ? `Met een piek van ${maxPerDay} geplande ritten` : "Geen data beschikbaar"} />
      </div>

      <div style={{ background: theme.cardBg, borderRadius: 24, border: `1px solid ${theme.border}`, padding: 24, boxShadow: theme.shadow }}>
        <h3 style={{ margin: "0 0 6px 0", color: theme.textMain }}>Ritten per Dag & Chauffeur</h3>
        <p style={{ margin: "0 0 20px 0", color: theme.textMuted, fontSize: 13 }}>Dagelijks overzicht van geplande en afgeronde ritten, opgesplitst per chauffeur.</p>
        
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {driverOptions.map(driver => (
            <div key={driver} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: driverColors[driver] || theme.chartBar }} />
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 700 }}>{driver}</span>
            </div>
          ))}
        </div>

        {dates.length === 0 ? (
          <div style={{ color: theme.textMuted, padding: 20, textAlign: "center", background: theme.bg, borderRadius: 12 }}>Geen ritten gevonden om weer te geven.</div>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10, height: 240 }}>
            {dates.map(date => {
              const dayRides = rides.filter(r => r.ride_date === date);
              const total = dayRides.length;
              const heightPct = chartYMax > 0 ? (total / chartYMax) * 100 : 0;
              
              return (
                <div key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 60, flex: 1, maxWidth: 80, height: "100%" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.textMain }}>{total}</div>
                  
                  <div style={{ height: "150px", width: "100%", maxWidth: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: theme.chartBg, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: `${heightPct}%`, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", transition: "height 0.8s ease" }}>
                      {driverOptions.map(driver => {
                        const count = dayRides.filter(r => r.driver_name === driver).length;
                        if (count === 0) return null;
                        
                        const segmentPct = total > 0 ? (count / total) * 100 : 0; 
                        return (
                          <div 
                            key={driver} 
                            title={`${driver}: ${count} ritten`}
                            style={{ 
                              height: `${segmentPct}%`,
                              width: "100%", 
                              background: driverColors[driver] || theme.chartBar,
                              borderTop: "1px solid rgba(255,255,255,0.2)"
                            }} 
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, textAlign: "center" }}>
                    {formatDate(date).split(" ")[0]}<br/>{formatDate(date).split(" ")[1]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 24 }}>
        
        {/* TIJDLIJN MET RODE CAPACITEITSLIJN */}
        <div style={{ background: theme.cardBg, borderRadius: 24, border: `1px solid ${theme.border}`, padding: 24, boxShadow: theme.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", color: theme.textMain }}>Tijdlijn & Capaciteit (4 Weken)</h3>
              <div style={{ fontSize: 12, color: theme.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 12, height: 2, background: "#ef4444" }}></span> 
                Rode lijn = maximale capaciteit ({dailyCapacity} ritten)
              </div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: isMobile ? 4 : 6, height: 180, paddingTop: 10, overflowX: "auto", paddingBottom: 10 }}>
            {fourWeeksDates.map((date) => {
              const count = rides.filter(r => r.ride_date === date).length;
              const isToday = date === todayString;
              const dateObj = new Date(date);
              const dayNameEn = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj);
              const weekdayStr = new Intl.DateTimeFormat("nl-NL", { weekday: "short" }).format(dateObj);
              const dayStr = parseInt(date.split('-')[2], 10);
              
              const prediction = predictions[dayNameEn] || 0;
              const heightPct = chartYMax > 0 ? (count / chartYMax) * 100 : 0;
              const predHeightPct = chartYMax > 0 ? (prediction / chartYMax) * 100 : 0;
              
              const isOverCapacity = Math.max(count, prediction) > dailyCapacity && date > todayString;

              return (
                <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 26, height: "100%" }}>
                  
                  {date > todayString ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                      <div style={{ color: count > dailyCapacity ? "#ef4444" : theme.textMain, fontWeight: 900, fontSize: 12 }} title={`${count} al gepland`}>{count > 0 ? count : "0"}</div>
                      {prediction > 0 && (
                        <div style={{ color: prediction > dailyCapacity ? "#ef4444" : theme.textMuted, fontSize: 10, fontWeight: 700, marginTop: 4 }} title={`Historisch verwacht: ~${prediction}`}>
                          (~{prediction})
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: theme.textMain, fontWeight: 800, fontSize: 11 }}>{count > 0 ? count : ""}</div>
                  )}
                  
                  <div style={{ width: "100%", maxWidth: 30, background: theme.chartBg, borderRadius: "4px 4px 0 0", height: "120px", position: "relative", display: "flex", alignItems: "flex-end" }}>
                    
                    {/* RODE CAPACITEITSLIJN (Dwars door de balk) */}
                    <div style={{ position: "absolute", bottom: `${(dailyCapacity / chartYMax) * 100}%`, left: -2, right: -2, height: 2, background: "#ef4444", zIndex: 10 }} title={`Limiet: ${dailyCapacity}`} />

                    {/* Voorspellings-schaduw */}
                    {date > todayString && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: isOverCapacity ? "rgba(239, 68, 68, 0.15)" : (theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), height: `${predHeightPct}%`, borderTop: `1px dashed ${isOverCapacity ? "#ef4444" : theme.textMuted}`, zIndex: 1 }} title={`Verwacht: ${prediction} ritten`} />
                    )}
                    {/* Echte geplande data */}
                    <div style={{ width: "100%", background: isToday ? theme.chartBar : (count > dailyCapacity ? "#ef4444" : (theme.isDark ? "#475569" : "#cbd5e1")), height: `${heightPct}%`, transition: "height 0.8s cubic-bezier(0.4, 0, 0.2, 1)", borderRadius: "4px 4px 0 0", opacity: isToday ? 1 : 0.8, zIndex: 2 }} />
                  </div>
                  
                  <div style={{ color: isToday ? theme.chartBar : (isOverCapacity ? "#ef4444" : theme.textMuted), fontSize: 10, fontWeight: isToday || isOverCapacity ? 800 : 600, textAlign: "center", lineHeight: 1.2 }} title={date}>
                    <div style={{ textTransform: "capitalize" }}>{weekdayStr}</div>
                    <div>{dayStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: theme.cardBg, borderRadius: 24, border: `1px solid ${theme.border}`, padding: 24, boxShadow: theme.shadow }}>
          <h3 style={{ margin: "0 0 20px 0", color: theme.textMain }}>Status Overzicht</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {statusCounts.map((stat) => {
              const pct = totalRides > 0 ? Math.round((stat.count / totalRides) * 100) : 0;
              const colorObj = getRideStatusStyle(stat.status, theme.isDark);
              return (
                <div key={stat.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, fontWeight: 700, color: theme.textMain }}>
                    <span>{stat.status}</span>
                    <span>{stat.count} ({pct}%)</span>
                  </div>
                  <div style={{ width: "100%", height: 10, background: theme.chartBg, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colorObj.color, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ background: theme.cardBg, borderRadius: 24, border: `1px solid ${theme.border}`, padding: 24, boxShadow: theme.shadow, overflowX: "auto" }}>
        <h3 style={{ margin: "0 0 20px 0", color: theme.textMain }}>Prestaties per Chauffeur</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ background: theme.tableHeaderBg, textAlign: "left" }}>
              <th style={{ padding: "12px 16px", color: theme.textMuted, fontSize: 13, fontWeight: 800 }}>Chauffeur</th>
              <th style={{ padding: "12px 16px", color: theme.textMuted, fontSize: 13, fontWeight: 800 }}>Totaal Toegewezen</th>
              <th style={{ padding: "12px 16px", color: theme.textMuted, fontSize: 13, fontWeight: 800 }}>Afgerond</th>
              <th style={{ padding: "12px 16px", color: theme.textMuted, fontSize: 13, fontWeight: 800 }}>On-Time Score</th>
            </tr>
          </thead>
          <tbody>
            {detailedDriverStats.map(stat => (
              <tr key={stat.name} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: "14px 16px", color: theme.textMain, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: driverColors[stat.name] || theme.chartBar }} />
                  {stat.name}
                </td>
                <td style={{ padding: "14px 16px", color: theme.textMain }}>{stat.total} ritten</td>
                <td style={{ padding: "14px 16px", color: theme.textMain }}>
                  {stat.completed} <span style={{ color: theme.textMuted, fontSize: 12 }}>({stat.total > 0 ? Math.round((stat.completed/stat.total)*100) : 0}%)</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, color: stat.otp >= 90 ? "#10b981" : stat.otp >= 75 ? "#f59e0b" : "#ef4444" }}>
                      {stat.otp}%
                    </span>
                    <span style={{ color: theme.textMuted, fontSize: 12 }}>(uit {stat.otpCount} gemeten)</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function AuthScreen() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 900;
  const { theme } = useContext(ThemeContext);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account aangemaakt. Je kunt nu inloggen.");
        setMode("signin");
      }
    } catch (err) { setError(err.message || "Er ging iets mis."); } finally { setLoading(false); }
  }

  const authBg = theme.isDark ? "linear-gradient(135deg, #0f172a 0%, #111827 60%, #1f2937 100%)" : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%)";

  return (
    <div style={{ minHeight: "100vh", background: authBg, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 16 : 24, fontFamily: "Arial, sans-serif", transition: "background 0.5s ease" }}>
      <div style={{ width: "100%", maxWidth: 980, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: 24 }}>
        <div style={{ color: "white", padding: isMobile ? 24 : 36, borderRadius: 28, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)", transition: "all 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
            <div style={{ width: 76, height: 76, borderRadius: 22, background: "white", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, boxShadow: "0 10px 24px rgba(17,24,39,0.2)", flexShrink: 0 }}>TP</div>
            <div style={{ color: "white", fontSize: isMobile ? 32 : 42, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.3s ease" }}>TYREPOINT</div>
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 36 : 46, lineHeight: 1.05 }}>Transport Planner</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: isMobile ? 16 : 18, lineHeight: 1.6, marginTop: 18, maxWidth: 520 }}>Een centraal en veilig platform voor efficiënte transportplanning, realtime rittenbeheer en prestatie-analyse.</p>
        </div>
        <div style={{ background: theme.isDark ? "#1e293b" : "#f1f5f9", borderRadius: 28, padding: isMobile ? 24 : 34, boxShadow: theme.shadow, transition: "all 0.3s ease" }}>
          <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 900, color: theme.textMain, marginBottom: 8, transition: "color 0.3s ease" }}>{mode === "signin" ? "Inloggen" : "Account aanmaken"}</div>
          <div style={{ color: theme.textMuted, marginBottom: 22, transition: "color 0.3s ease" }}>{mode === "signin" ? "Vul je e-mailadres en wachtwoord in om toegang te krijgen tot de planning." : "Vul je gegevens in om een veilig account aan te maken voor het beheer van de ritten."}</div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={getLabelStyle(theme)}>E-mailadres <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={getInputStyle(theme)} /></label>
            <label style={getLabelStyle(theme)}>Wachtwoord <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={getInputStyle(theme)} /></label>
            <button type="submit" style={getPrimaryButtonStyle(theme)} disabled={loading}>{loading ? "Bezig..." : mode === "signin" ? "Inloggen" : "Account aanmaken"}</button>
          </form>
          {message && <div style={{ marginTop: 14, background: theme.isDark ? "rgba(22,101,52,0.3)" : "#ecfdf5", color: theme.isDark ? "#86efac" : "#166534", border: theme.isDark ? "1px solid rgba(22,101,52,0.5)" : "1px solid #bbf7d0", borderRadius: 14, padding: "12px 14px", fontWeight: 700 }}>{message}</div>}
          {error && <div style={{ marginTop: 14, background: theme.isDark ? "rgba(185,28,28,0.3)" : "#fef2f2", color: theme.isDark ? "#fca5a5" : "#b91c1c", border: theme.isDark ? "1px solid rgba(185,28,28,0.5)" : "1px solid #fecaca", borderRadius: 14, padding: "12px 14px", fontWeight: 700 }}>{error}</div>}
          <div style={{ marginTop: 18 }}>
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setError(""); }} style={getSecondaryButtonStyle(theme)}>
              {mode === "signin" ? "Nieuw account maken" : "Terug naar inloggen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RideEditor({ selectedRide, onSave, onDelete, onNew, saving, onShift, onMarkPrinted }) {
  const windowWidth = useWindowWidth();
  const isSmall = windowWidth < 700;
  const { theme } = useContext(ThemeContext);

  function createFormState(ride) {
    const vandaag = new Date().toISOString().slice(0, 10);
    return {
      id: ride?.id || null, 
      driver_name: ride?.driver_name || driverOptions[0], 
      ride_date: ride?.ride_date || vandaag, 
      departure_time: ride?.departure_time || "", 
      arrival_time: ride?.arrival_time || "", 
      actual_arrival_time: ride?.actual_arrival_time || "",
      pickup_location: ride?.pickup_location || "", 
      delivery_location: ride?.delivery_location || "", 
      cargo: ride?.cargo || "", 
      notes: ride?.notes || "", 
      status: ride?.status || "Gepland",
      workcard_printed: ride?.workcard_printed || false,
    };
  }

  const [formData, setFormData] = useState(createFormState(selectedRide));
  const [isReturnDraft, setIsReturnDraft] = useState(false);
  const [shiftMinutes, setShiftMinutes] = useState(30);

  useEffect(() => {
    setFormData(createFormState(selectedRide));
    setIsReturnDraft(false);
  }, [selectedRide]);

  function updateField(field, value) {
    setFormData((prev) => {
      const updates = { [field]: value };
      if (field === "status" && value === "Afgerond" && prev.status !== "Afgerond" && !prev.actual_arrival_time) {
        const nu = new Date();
        updates.actual_arrival_time = `${String(nu.getHours()).padStart(2, "0")}:${String(nu.getMinutes()).padStart(2, "0")}`;
      }
      return { ...prev, ...updates };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.ride_date || !formData.departure_time || !formData.pickup_location.trim() || !formData.delivery_location.trim()) {
      return alert("Vul datum, vertrektijd, van-locatie en naar-locatie in.");
    }
    onSave({ ...formData, pickup_location: formData.pickup_location.trim(), delivery_location: formData.delivery_location.trim(), cargo: formData.cargo.trim(), notes: formData.notes.trim() });
  }

  function handleCreateReturnRide() {
    if (!selectedRide) return;
    setFormData({
      ...formData, id: null, departure_time: addMinutesToTimeString(formData.arrival_time, 15), arrival_time: "", actual_arrival_time: "",
      pickup_location: formData.delivery_location || "", delivery_location: formData.pickup_location || "", cargo: "", notes: "", status: "Gepland", workcard_printed: false
    });
    setIsReturnDraft(true);
  }

  const isEditingOriginalRide = Boolean(selectedRide?.id) && !isReturnDraft;

  return (
    <div style={{ background: theme.cardBg, borderRadius: 20, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 16, position: windowWidth < 1000 ? "static" : "sticky", top: 98, transition: "all 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: theme.textMain, transition: "color 0.3s ease" }}>
            {isEditingOriginalRide ? "Rit bewerken" : isReturnDraft ? "Nieuwe retour rit" : "Nieuwe rit"}
          </div>
        </div>
        {isEditingOriginalRide && (
          <button type="button" onClick={onNew} style={{ ...getSecondaryButtonStyle(theme), padding: "8px 12px", fontSize: 12 }}>Nieuw</button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={getLabelStyle(theme)}>Chauffeur<select value={formData.driver_name} onChange={(e) => updateField("driver_name", e.target.value)} style={getInputStyle(theme)}>{driverOptions.map((driver) => (<option key={driver} value={driver}>{driver}</option>))}</select></label>
          <label style={getLabelStyle(theme)}>Datum<input type="date" value={formData.ride_date} onChange={(e) => updateField("ride_date", e.target.value)} style={getInputStyle(theme)} /></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={getLabelStyle(theme)}>Vertrek<input type="time" value={formData.departure_time} onChange={(e) => updateField("departure_time", e.target.value)} style={getInputStyle(theme)} /></label>
          <label style={getLabelStyle(theme)}>Aankomst<input type="time" value={formData.arrival_time} onChange={(e) => updateField("arrival_time", e.target.value)} style={getInputStyle(theme)} /></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={getLabelStyle(theme)}>Status<select value={formData.status} onChange={(e) => updateField("status", e.target.value)} style={getInputStyle(theme)}>{rideStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}</select></label>
          <label style={getLabelStyle(theme)}>Echte Tijd<input type="time" value={formData.actual_arrival_time} onChange={(e) => updateField("actual_arrival_time", e.target.value)} style={{ ...getInputStyle(theme), background: formData.status === "Afgerond" ? (theme.isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5") : theme.inputBg, border: formData.status === "Afgerond" ? "1px solid #10b981" : `1px solid ${theme.inputBorder}` }} /></label>
        </div>

        <label style={getLabelStyle(theme)}>Van locatie<input type="text" value={formData.pickup_location} onChange={(e) => updateField("pickup_location", e.target.value)} placeholder="Bijv. Amsterdam" style={getInputStyle(theme)} /></label>
        <label style={getLabelStyle(theme)}>Naar locatie<input type="text" value={formData.delivery_location} onChange={(e) => updateField("delivery_location", e.target.value)} placeholder="Bijv. Rotterdam" style={getInputStyle(theme)} /></label>
        <label style={getLabelStyle(theme)}>Kenteken / Lading<input type="text" value={formData.cargo} onChange={(e) => updateField("cargo", e.target.value)} placeholder="Bijv. V-123-AB" style={getInputStyle(theme)} /></label>
        <label style={getLabelStyle(theme)}>Notities<textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Extra instructies" style={{ ...getInputStyle(theme), minHeight: 60, resize: "vertical" }} /></label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <button type="submit" style={getPrimaryButtonStyle(theme)} disabled={saving}>{saving ? "Opslaan..." : isEditingOriginalRide ? "Wijzigen" : isReturnDraft ? "Retour opslaan" : "Rit opslaan"}</button>
          {isEditingOriginalRide && (
            <>
              <button type="button" onClick={handleCreateReturnRide} disabled={saving} style={getSecondaryButtonStyle(theme)}>Retour</button>
              <button 
                type="button" 
                onClick={() => { 
                  exportRideToWord(selectedRide); 
                  if (selectedRide.id && !selectedRide.workcard_printed) {
                    onMarkPrinted(selectedRide.id);
                  }
                }} 
                disabled={saving} 
                style={{ ...getSecondaryButtonStyle(theme), background: theme.isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff", color: theme.isDark ? "#93c5fd" : "#1d4ed8", border: theme.isDark ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid #bfdbfe", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}
              >
                📄 Werkkaart {selectedRide?.workcard_printed && <span style={{ color: "#10b981", fontSize: "14px", fontWeight: "900" }} title="Is al geprint">✔</span>}
              </button>
              <button type="button" onClick={() => onDelete(selectedRide.id)} disabled={saving} style={{ background: theme.isDark ? "rgba(185, 28, 28, 0.2)" : "#fee2e2", color: theme.isDark ? "#fca5a5" : "#b91c1c", border: theme.isDark ? "1px solid rgba(185, 28, 28, 0.4)" : "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer", transition: "all 0.3s ease" }}>Verwijderen</button>
            </>
          )}
        </div>

        {isEditingOriginalRide && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.border}`, display: "flex", flexDirection: "column", gap: 8, transition: "border-color 0.3s ease" }}>
            <div style={{ color: theme.textMain, fontSize: 13, fontWeight: 700 }}>Bulk opschuiven</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="number" value={shiftMinutes} onChange={(e) => setShiftMinutes(Number(e.target.value))} style={{ ...getInputStyle(theme), width: 70, padding: "8px 10px" }} />
              <span style={{ fontSize: 13, color: theme.textMuted }}>min.</span>
              <button type="button" disabled={saving || !onShift} onClick={() => onShift(selectedRide.driver_name, selectedRide.ride_date, selectedRide.departure_time, shiftMinutes)} style={{ ...getSecondaryButtonStyle(theme), padding: "8px 12px", background: theme.isDark ? "#334155" : "#f3f4f6" }}>Verschuiven</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function RideCardsMobile({ rides, selectedRideId, onSelectRide }) {
  const { theme } = useContext(ThemeContext);
  const locationLinkStyle = { color: theme.isDark ? "#60a5fa" : "#2563eb", textDecoration: "none", fontWeight: 700 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rides.length === 0 ? (
        <div style={{ background: theme.cardBg, borderRadius: 20, border: `1px solid ${theme.border}`, padding: 20, textAlign: "center", color: theme.textMuted }}>Geen ritten gevonden.</div>
      ) : (
        rides.map((ride) => {
          const selected = selectedRideId === ride.id;
          const isCompleted = ride.status === "Afgerond" && ride.actual_arrival_time;

          return (
            <button key={ride.id} type="button" onClick={() => onSelectRide(ride)} style={{ width: "100%", textAlign: "left", background: selected ? theme.rowSelected : theme.cardBg, border: selected ? `1px solid ${theme.rowSelectedBorder}` : `1px solid ${theme.border}`, borderRadius: 20, padding: 16, cursor: "pointer", boxShadow: theme.shadow, transition: "all 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 900, color: theme.textMain, fontSize: 15 }}>{formatDate(ride.ride_date)}</div>
                  <div style={{ color: theme.textMuted, marginTop: 4, fontWeight: 700 }}>{ride.departure_time} → {isCompleted ? <span style={{ color: "#10b981" }}>{ride.actual_arrival_time}</span> : ride.arrival_time || "—"}</div>
                </div>
                <Badge style={getRideStatusStyle(ride.status, theme.isDark)}>{ride.status}</Badge>
              </div>
              <div style={{ marginTop: 12, color: theme.textMain, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                {ride.driver_name} 
                {ride.workcard_printed && <span title="Werkkaart is geprint" style={{ fontSize: 14 }}>📄</span>}
              </div>
              <div style={{ marginTop: 10, color: theme.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                <div><strong>Van:</strong> <a href={getMapUrl(ride.pickup_location)} target="_blank" rel="noreferrer" style={locationLinkStyle} onClick={(e) => e.stopPropagation()}>{ride.pickup_location || "—"}</a></div>
                <div style={{ marginTop: 4 }}><strong>Naar:</strong> <a href={getMapUrl(ride.delivery_location)} target="_blank" rel="noreferrer" style={locationLinkStyle} onClick={(e) => e.stopPropagation()}>{ride.delivery_location || "—"}</a></div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

function RideTable({ rides, selectedRideId, onSelectRide, search, setSearch, statusFilter, setStatusFilter, driverFilter, setDriverFilter, dateFilter, setDateFilter, clearFilters }) {
  const windowWidth = useWindowWidth();
  const isNarrow = windowWidth < 900;
  const isMobileCards = windowWidth < 700;
  const { theme } = useContext(ThemeContext);

  const thStyle = { padding: "14px 16px", fontSize: 13, fontWeight: 800, color: theme.textMuted };
  const tdStyle = { padding: "14px 16px", verticalAlign: "middle", color: theme.textMain, fontSize: 14 };
  const locationLinkStyle = { color: theme.isDark ? "#60a5fa" : "#2563eb", textDecoration: "none", fontWeight: 700 };

  return (
    <div style={{ background: theme.cardBg, borderRadius: 24, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, overflow: "hidden", transition: "all 0.3s ease" }}>
      <div style={{ padding: 20, borderBottom: `1px solid ${theme.border}`, transition: "border-color 0.3s ease" }}>
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr 1fr 1fr auto", gap: 12 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op locatie of notities..." style={getInputStyle(theme)} />
          <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} style={getInputStyle(theme)}><option value="all">Alle chauffeurs</option>{driverOptions.map((driver) => (<option key={driver} value={driver}>{driver}</option>))}</select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={getInputStyle(theme)}><option value="all">Alle statussen</option>{rideStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}</select>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={getInputStyle(theme)} />
          <button type="button" onClick={clearFilters} style={getSecondaryButtonStyle(theme)}>Wissen</button>
        </div>
      </div>

      {isMobileCards ? (
        <div style={{ padding: 12, background: theme.bg }}><RideCardsMobile rides={rides} selectedRideId={selectedRideId} onSelectRide={onSelectRide} /></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr style={{ background: theme.tableHeaderBg, textAlign: "left" }}>
                <th style={thStyle}>Datum</th><th style={thStyle}>Tijd</th><th style={thStyle}>Chauffeur</th><th style={thStyle}>Van</th><th style={thStyle}>Naar</th><th style={thStyle}>Vervoer</th><th style={thStyle}>Status</th><th style={thStyle}>Notities</th>
              </tr>
            </thead>
            <tbody>
              {rides.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: theme.textMuted }}>Geen ritten gevonden.</td></tr>
              ) : (
                rides.map((ride) => {
                  const selected = selectedRideId === ride.id;
                  const isCompleted = ride.status === "Afgerond" && ride.actual_arrival_time;

                  return (
                    <tr key={ride.id} onClick={() => onSelectRide(ride)} style={{ background: selected ? theme.rowSelected : "transparent", cursor: "pointer", borderTop: `1px solid ${theme.border}`, transition: "background 0.3s ease" }}>
                      <td style={tdStyle}>{formatDate(ride.ride_date)}</td>
                      <td style={tdStyle}><div style={{ fontWeight: 800, color: theme.textMain }}>{ride.departure_time} → {isCompleted ? (<span style={{ color: "#10b981" }} title="Echte aankomsttijd">{ride.actual_arrival_time}</span>) : (ride.arrival_time)}</div></td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ride.driver_name} 
                          {ride.workcard_printed && <span title="Werkkaart is geprint" style={{ fontSize: 13 }}>📄</span>}
                        </div>
                      </td>
                      <td style={tdStyle}><a href={getMapUrl(ride.pickup_location)} target="_blank" rel="noreferrer" style={locationLinkStyle} onClick={(e) => e.stopPropagation()}>{ride.pickup_location || "—"}</a></td>
                      <td style={tdStyle}><a href={getMapUrl(ride.delivery_location)} target="_blank" rel="noreferrer" style={locationLinkStyle} onClick={(e) => e.stopPropagation()}>{ride.delivery_location || "—"}</a></td>
                      <td style={tdStyle}>{ride.cargo}</td>
                      <td style={tdStyle}><Badge style={getRideStatusStyle(ride.status, theme.isDark)}>{ride.status}</Badge></td>
                      <td style={tdStyle}>
                        <div style={{ minWidth: 150, whiteSpace: "normal", wordWrap: "break-word", color: theme.textMuted, fontSize: 13, lineHeight: 1.4 }}>
                          {ride.notes || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Dashboard({ session }) {
  const windowWidth = useWindowWidth();
  const isTabletOrSmaller = windowWidth < 1000;
  const isPhone = windowWidth < 600;
  const { theme } = useContext(ThemeContext);

  const [activeTab, setActiveTab] = useState("planning");
  const [rides, setRides] = useState([]);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [leftWidthPct, setLeftWidthPct] = useState(70);

  async function fetchRidesData() {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .order("ride_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (!error) {
      return sortRides(data || []);
    } else {
      console.error(error.message);
      return null;
    }
  }

  async function loadRides() {
    setLoading(true);
    const sorted = await fetchRidesData();
    if (sorted) {
      setRides(sorted);
      if (sorted.length > 0 && !selectedRideId) {
        setSelectedRideId(sorted[0].id);
      }
    }
    setLoading(false);
  }

  async function refreshRidesBackground() {
    const sorted = await fetchRidesData();
    if (sorted) {
      setRides(sorted);
    }
  }

  useEffect(() => {
    loadRides(); 

    const rideSubscription = supabase
      .channel('public-rides-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          refreshRidesBackground();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rideSubscription);
    };
  }, []);

  async function saveRide(ride) {
    setSaving(true);
    let apiCall;
    if (ride.id) {
      apiCall = supabase.from("rides").update(ride).eq("id", ride.id);
    } else {
      const { id, ...rideWithoutId } = ride;
      apiCall = supabase.from("rides").insert(rideWithoutId);
    }

    const { data, error } = await apiCall.select().single();
    if (error) {
      alert(error.message);
    } else if (data) {
      setRides((prev) => sortRides(ride.id ? prev.map((r) => (r.id === data.id ? data : r)) : [...prev, data]));
      setSelectedRideId(data.id);
    }
    setSaving(false);
  }

  async function markWorkcardPrinted(rideId) {
    if (!rideId) return;
    const { error } = await supabase.from("rides").update({ workcard_printed: true }).eq("id", rideId);
    if (!error) {
      setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, workcard_printed: true } : r));
    } else {
      console.error("Fout bij opslaan werkkaart status:", error.message);
    }
  }

  async function deleteRide(rideId) {
    if (!window.confirm("Weet je zeker dat je deze rit wilt verwijderen?")) return;
    setSaving(true);
    const { error } = await supabase.from("rides").delete().eq("id", rideId);
    if (error) { alert(error.message); } else {
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      setSelectedRideId(null);
    }
    setSaving(false);
  }

  async function shiftSubsequentRides(driver_name, ride_date, from_time, minutesToAdd) {
    if (!minutesToAdd || minutesToAdd === 0) return;
    const ridesToShift = rides.filter((r) => r.driver_name === driver_name && r.ride_date === ride_date && r.departure_time >= from_time);
    if (ridesToShift.length === 0) return alert("Geen ritten gevonden.");
    if (!window.confirm(`Weet je zeker dat je ${ridesToShift.length} rit(ten) wilt opschuiven?`)) return;

    setSaving(true);
    try {
      await Promise.all(
        ridesToShift.map((r) => supabase.from("rides").update({ departure_time: addMinutesToTimeString(r.departure_time, minutesToAdd), arrival_time: r.arrival_time ? addMinutesToTimeString(r.arrival_time, minutesToAdd) : "", }).eq("id", r.id))
      );
      await loadRides();
    } catch (err) { alert("Fout bij opschuiven."); } finally { setSaving(false); }
  }

  async function signOut() { await supabase.auth.signOut(); }
  function newRide() { setSelectedRideId(null); }

  const filteredRides = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return rides.filter((ride) => {
      if (!dateFilter && ride.status === "Afgerond" && ride.ride_date < today) return false;
      const matchesSearch = !q || (ride.pickup_location || "").toLowerCase().includes(q) || (ride.delivery_location || "").toLowerCase().includes(q) || ride.driver_name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || ride.status === statusFilter;
      const matchesDriver = driverFilter === "all" || ride.driver_name === driverFilter;
      const matchesDate = !dateFilter || ride.ride_date === dateFilter;
      return matchesSearch && matchesStatus && matchesDriver && matchesDate;
    });
  }, [rides, search, statusFilter, driverFilter, dateFilter]);

  const selectedRide = filteredRides.find((r) => r.id === selectedRideId) || rides.find((r) => r.id === selectedRideId) || null;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "Arial, sans-serif", transition: "background 0.3s ease" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "#0f172a", color: "white", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: isPhone ? "16px" : "16px 3%", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "white", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, flexShrink: 0 }}>TP</div>
            <div>
              <div style={{ fontSize: isPhone ? 24 : 30, fontWeight: 900 }}>Transport Planner</div>
              <div style={{ color: "#cbd5e1", marginTop: 6, transition: "color 0.3s ease" }}>Ingelogd als {session.user.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <DarkModeToggle />
            <button type="button" onClick={signOut} style={darkGhostButtonStyle}>Uitloggen</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "100%", margin: "0 auto", padding: isPhone ? 16 : "24px 3%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `2px solid ${theme.border}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTab("planning")} style={getTabStyle(activeTab === "planning", theme)}>📋 Planning</button>
            <button onClick={() => setActiveTab("statistics")} style={getTabStyle(activeTab === "statistics", theme)}>📊 Statistieken</button>
          </div>
          
          {!isTabletOrSmaller && activeTab === "planning" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8 }}>
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 700 }}>↔ Scherm indeling:</span>
              <input 
                type="range" 
                min="50" 
                max="85" 
                value={leftWidthPct} 
                onChange={(e) => setLeftWidthPct(Number(e.target.value))} 
                style={{ cursor: "ew-resize", width: 120 }} 
                title="Versleep om de tabel breder of smaller te maken"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ background: theme.cardBg, padding: 24, borderRadius: 24, color: theme.textMain }}>Laden...</div>
        ) : activeTab === "statistics" ? (
          <StatisticsDashboard rides={rides} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isTabletOrSmaller ? "1fr" : `${leftWidthPct}fr ${100 - leftWidthPct}fr`,
              gap: 24,
              alignItems: "start",
              animation: "fadeIn 0.5s ease",
            }}
          >
            <RideTable
              rides={filteredRides}
              selectedRideId={selectedRideId}
              onSelectRide={(r) => setSelectedRideId(r.id)}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              driverFilter={driverFilter}
              setDriverFilter={setDriverFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              clearFilters={() => { setSearch(""); setStatusFilter("all"); setDriverFilter("all"); setDateFilter(""); }}
            />

            <RideEditor
              selectedRide={selectedRide}
              onSave={saveRide}
              onDelete={deleteRide}
              onNew={newRide}
              saving={saving}
              onShift={shiftSubsequentRides}
              onMarkPrinted={markWorkcardPrinted}
            />
          </div>
        )}
      </main>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function MainApp() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.transition = "background-color 0.3s ease";
  }, [theme.bg]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session ?? null); setCheckingSession(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session ?? null); setCheckingSession(false); });
    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) return <div style={{ padding: 24, color: theme.textMain, background: theme.bg, minHeight: "100vh" }}>Laden...</div>;
  if (!session) return <AuthScreen />;
  return <Dashboard session={session} />;
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") === "dark";
    return false;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const nextTheme = !prev;
      localStorage.setItem("theme", nextTheme ? "dark" : "light");
      return nextTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: isDarkMode ? darkTheme : lightTheme, toggleTheme }}>
      <MainApp />
    </ThemeContext.Provider>
  );
}