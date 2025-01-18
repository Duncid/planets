import "@fortawesome/fontawesome-free/css/all.min.css";
import { initDashboard } from "./dashboard.js";
import { createDateTimeInputs, enableUpdates } from "./input.js";
import { initPlanetScene, updateScene } from "./planet.js";
import "./style.css";

if (typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = function () {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  };
}

let latitude = 48.85;
let longitude = 2.29;

let getCurrentDateTime;

function main() {
  // Create main container layout
  const mainContainer = document.createElement("div");
  mainContainer.id = "app-container";
  document.body.appendChild(mainContainer);

  // Container for scene
  const sceneContainer = document.createElement("div");
  sceneContainer.id = "scene-container";
  mainContainer.appendChild(sceneContainer);

  // Container for scene inputs
  const inputContainer = document.createElement("div");
  inputContainer.id = "input-container";
  sceneContainer.appendChild(inputContainer);

  // Sidebar for dashboard
  const sidebar = document.createElement("div");
  sidebar.id = "dashboard-container";
  mainContainer.appendChild(sidebar);

  initPlanetScene(sceneContainer);

  const {
    getCurrentDateTime: gctd,
    normalizeDateTime,
    setNow,
  } = createDateTimeInputs(inputContainer, () => {
    updateScene(latitude, longitude, gctd());
  });
  getCurrentDateTime = gctd;

  normalizeDateTime();
  enableUpdates();

  const nowButton = document.createElement("button");
  nowButton.innerHTML = '<i class="fa fa-calendar-day" aria-hidden="true"></i>';
  nowButton.className = "button";
  inputContainer.appendChild(nowButton);
  nowButton.addEventListener("click", () => {
    setNow();
  });

  const geoButton = document.createElement("button");
  geoButton.innerHTML =
    '<i class="fa fa-location-arrow" aria-hidden="true"></i>';
  geoButton.className = "button";
  inputContainer.appendChild(geoButton);

  let currentCoords = {
    latitude: latitude,
    longitude: longitude,
  };

  updateScene(
    currentCoords.latitude,
    currentCoords.longitude,
    getCurrentDateTime()
  );
  //initDashboard(currentCoords.latitude, currentCoords.longitude);
  document.addEventListener("DOMContentLoaded", () => {
    const latitude = 48.85;
    const longitude = 2.29;

    initDashboard(latitude, longitude);
  });

  // Add resize handler
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateScene(
        currentCoords.latitude,
        currentCoords.longitude,
        getCurrentDateTime()
      );
    }, 250);
  });

  // Update the geolocation handler to store current coordinates
  geoButton.addEventListener("click", () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentCoords.latitude = pos.coords.latitude || 48.85;
          currentCoords.longitude = pos.coords.longitude || 2.29;
          console.log(
            "Updated coordinates:",
            currentCoords.latitude,
            currentCoords.longitude
          );
          updateScene(
            currentCoords.latitude,
            currentCoords.longitude,
            getCurrentDateTime()
          );
          initDashboard(currentCoords.latitude, currentCoords.longitude);
        },
        (err) => {
          console.warn("Geolocation error:", err);
          alert("Unable to fetch location. Using default coordinates.");
          currentCoords = { latitude: 48.85, longitude: 2.29 };
          initDashboard(currentCoords.latitude, currentCoords.longitude);
        }
      );
    }
  });
}

main();
