import * as Astronomy from "astronomy-engine";
import { updateScene } from "./planet.js";

const LAT = 48.85;
const LON = 2.29;

export async function initDashboard(latitude = LAT, longitude = LON) {
  const daysData = await buildData(latitude, longitude);
  renderHeader(latitude, longitude); // Add the header
  render(daysData);
}

async function buildData(latitude, longitude) {
  const now = new Date();
  const weatherData = await fetchWeatherData(latitude, longitude);

  const days = [];

  for (let i = 0; i < 10; i++) {
    const currentDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + i
    );
    const dayStr = formatDate(currentDay);
    const dayWeather = weatherData.find((d) => d.date === dayStr) || {};

    const sunsetTime = dayWeather.sunset || "N/A"; // Use sunset from weather data
    const moonPhase = getMoonPhase(currentDay);
    const visiblePlanets = getVisiblePlanets(currentDay, latitude, longitude);

    days.push({
      date: dayStr,
      sunset: sunsetTime,
      clearSkyProbability:
        typeof dayWeather.clearSky === "number"
          ? `${Math.round(dayWeather.clearSky * 100)}%`
          : "N/A",
      temperature: dayWeather.temperature
        ? `${dayWeather.temperature}°C`
        : "N/A",
      moonPhase,
      visiblePlanets,
    });
  }

  return days;
}

function renderHeader(latitude, longitude) {
  const container = document.getElementById("dashboard-container");
  if (!container) {
    console.error("Dashboard container is missing in the DOM.");
    return;
  }

  let header = document.getElementById("dashboard-header");
  if (!header) {
    console.log("Creating new dashboard header.");
    header = document.createElement("div");
    header.id = "dashboard-header";
    container.prepend(header);
  }

  console.log("Updating header content.");
  const currentTime = new Date().toLocaleString("en-US", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  header.innerHTML = `
      <div>
          <h2>Local Time</h2>
          <p>${currentTime}</p>
      </div>
      <div>
          <h2>Location</h2>
          <p>Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}</p>
      </div>
  `;
}

async function fetchWeatherData(lat, lon) {
  const apiKey = "d610b7790b35500fca37572cf328388b";
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return processWeatherData(data);
  } catch (e) {
    console.warn("Weather data not available:", e);
    return [
      {
        date: formatDate(new Date()),
        temperature: "N/A",
        clearSky: 0,
        sunset: "N/A", // Default sunset value
      },
    ];
  }
}

function processWeatherData(data) {
  const dailyMap = {};
  for (const item of data.list) {
    const dt = new Date(item.dt * 1000);
    const dateStr = dt.toISOString().split("T")[0];
    if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
    dailyMap[dateStr].push(item);
  }

  const results = [];
  for (const dateStr in dailyMap) {
    const forecasts = dailyMap[dateStr];
    let chosen = forecasts.reduce((prev, curr) => {
      const currHour = new Date(curr.dt * 1000).getHours();
      const prevHour = new Date(prev.dt * 1000).getHours();
      return Math.abs(currHour - 18) < Math.abs(prevHour - 18) ? curr : prev;
    }, forecasts[0]);

    const clouds = chosen.clouds?.all || 100;
    const clearSky = 1 - clouds / 100;
    const temperature = chosen.main?.temp;
    const sunset = chosen.sys?.sunset
      ? new Date(chosen.sys.sunset * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

    results.push({
      date: dateStr,
      temperature: temperature,
      clearSky: clearSky,
      sunset: sunset,
    });
  }
  return results;
}

function getMoonPhase(date) {
  const time = Astronomy.MakeTime(date);
  const moonPhase = Astronomy.MoonPhase(time);
  const phases = [
    { name: "🌒", start: 0, end: 45 }, // Waxing Crescent
    { name: "🌓", start: 45, end: 90 }, // First Quarter
    { name: "🌔", start: 90, end: 135 }, // Waxing Gibbous
    { name: "🌕", start: 135, end: 225 }, // Full Moon
    { name: "🌖", start: 225, end: 270 }, // Waning Gibbous
    { name: "🌗", start: 270, end: 315 }, // Last Quarter
    { name: "🌘", start: 315, end: 360 }, // Waning Crescent
  ];
  return (
    phases.find((p) => moonPhase >= p.start && moonPhase < p.end)?.name || "🌑"
  );
}

function getVisiblePlanets(date, lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") {
    console.error("Invalid latitude or longitude for getVisiblePlanets:", {
      lat,
      lon,
    });
    return [];
  }

  const observer = new Astronomy.Observer(lat, lon, 0);
  const time = Astronomy.MakeTime(date);
  const planets = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  const visible = [];
  for (const p of planets) {
    const equ = Astronomy.Equator(p, time, observer, false, true);
    const hor = Astronomy.Horizon(time, observer, equ.ra, equ.dec, "normal");
    if (hor.altitude > 10) {
      visible.push(p);
    }
  }
  return visible;
}

// CHANGED: Now uses local time offset so we don't get stuck on "yesterday" in UTC
function formatDate(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

// function render(days) {
//   const container = document.getElementById("dashboard-container");
//   if (!container) return;

//   if (!days || days.length === 0) {
//     container.innerHTML = `<p>No data available to display.</p>`;
//     return;
//   }

//   container.innerHTML = `
//     <div class="astro-grid">
//       ${days
//         .map(
//           (day) => `
//         <div class="astro-card" data-date="${
//           day.date
//         }" role="button" tabindex="0">
//           <div class="card-header">
//             <h3>${new Intl.DateTimeFormat("fr-FR", {
//               weekday: "long",
//               day: "numeric",
//               month: "long",
//             }).format(new Date(day.date))}</h3>
//           </div>
//           <div class="card-content">
//             <div class="card-item">
//               <span class="label">Sunset:</span>
//               <span class="value">${day.sunset}</span>
//             </div>
//             <div class="card-item">
//               <span class="label">Moon Phase:</span>
//               <span class="value">${day.moonPhase}</span>
//             </div>
//             <div class="card-item">
//               <span class="label">Visible Planets:</span>
//               <span class="value">${
//                 day.visiblePlanets.join(", ") || "None"
//               }</span>
//             </div>
//             <div class="card-item">
//               <span class="label">Temperature:</span>
//               <span class="value">${day.temperature}</span>
//             </div>
//             <div class="card-item">
//               <span class="label">Clear Sky:</span>
//               <span class="value">${day.clearSkyProbability}</span>
//             </div>
//           </div>
//         </div>
//       `
//         )
//         .join("")}
//     </div>
//   `;

//   // Add click handlers to all cards
//   const cards = container.querySelectorAll(".astro-card");
//   cards.forEach((card) => {
//     card.addEventListener("click", () => {
//       const date = new Date(card.dataset.date);
//       date.setHours(21, 0, 0); // Set to 21:00

//       // Get current coordinates
//       const lat =
//         parseFloat(document.querySelector("[data-lat]")?.dataset.lat) || 48.85;
//       const lon =
//         parseFloat(document.querySelector("[data-lon]")?.dataset.lon) || 2.29;

//       // Update both the scene and inputs
//       updateScene(lat, lon, date);
//     });
//   });
// }

function render(days) {
  const container = document.getElementById("dashboard-container");
  if (!container) return;

  if (!days || days.length === 0) {
    container.innerHTML = `<p>No data available to display.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="astro-grid">
      ${days
        .map(
          (day) => `
            <div class="astro-card" data-date="${
              day.date
            }" role="button" tabindex="0">
              <div class="card-header">
                <h3 class="capitalize">${new Intl.DateTimeFormat("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(day.date))}</h3>
              </div>
              <div class="card-content">
                <div class="card-item">
                  <span class="label">Sunset:</span>
                  <span class="value">${day.sunset}</span>
                </div>
                <div class="card-item">
                  <span class="label">Moon Phase:</span>
                  <span class="value">${day.moonPhase}</span>
                </div>
                <div class="card-item">
                  <span class="label">Visible Planets:</span>
                  <span class="value">${
                    day.visiblePlanets.join(", ") || "None"
                  }</span>
                </div>
                <div class="card-item">
                  <span class="label">Temperature:</span>
                  <span class="value">${day.temperature}</span>
                </div>
                <div class="card-item">
                  <span class="label">Clear Sky:</span>
                  <span class="value">${day.clearSkyProbability}</span>
                </div>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  // Add click handlers to all cards
  const cards = container.querySelectorAll(".astro-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const date = new Date(card.dataset.date);
      date.setHours(21, 0, 0); // Set to 21:00

      // Get current coordinates
      const lat =
        parseFloat(document.querySelector("[data-lat]")?.dataset.lat) || 48.85;
      const lon =
        parseFloat(document.querySelector("[data-lon]")?.dataset.lon) || 2.29;

      // Update both the scene and inputs
      updateScene(lat, lon, date);
    });
  });
}
