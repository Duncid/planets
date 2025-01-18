import * as Astronomy from "astronomy-engine";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let horizon;
let planetAndMoons = {};
const textureLoader = new THREE.TextureLoader();
const loadedTextures = {};

const MOON_SIZE = 0.02;
const SUN_LIGHT_INTENSITY = 2.0;
const RING_INNER_FACTOR = 1.5;
const RING_OUTER_FACTOR = 2.0;
const MOON_ORBIT_FACTOR = 3;

const planetNames = [
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Moon",
];

const planetDistanceMap = {
  Sun: 4.0, // around the same as before
  Moon: 3.6, // place the Moon slightly closer
  Mercury: 4.2, // a bit further
  Venus: 4.3, // tweak as needed
  Mars: 4.5,
  Jupiter: 5.0,
  Saturn: 5.2,
};

const planetData = {
  Sun: { size: 0.5, moons: [], hasRing: false },
  Mercury: { size: 0.05, moons: [], hasRing: false },
  Venus: { size: 0.1, moons: [], hasRing: false },
  Mars: { size: 0.08, moons: ["Phobos", "Deimos"], hasRing: false },
  Jupiter: {
    size: 0.15,
    moons: ["Io", "Europa", "Ganymede", "Callisto"],
    hasRing: false,
  },
  Saturn: {
    size: 0.12,
    moons: ["Titan", "Rhea", "Iapetus", "Dione"],
    hasRing: true,
  },
  Moon: { size: 0.3, moons: [], hasRing: false },
};

const textureMap = {
  Sun: "2k_sun.jpg",
  Mercury: "2k_mercury.jpg",
  Venus: "2k_venus_surface.jpg",
  Mars: "2k_mars.jpg",
  Jupiter: "2k_jupiter.jpg",
  Saturn: "2k_saturn.jpg",
  Moon: "2k_moon.jpg",
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let tooltip;

export function initPlanetScene(sceneContainer) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    sceneContainer.clientWidth / sceneContainer.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
  sceneContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);

  const horizonGeom = new THREE.RingGeometry(4.9, 5, 64);
  const horizonMat = new THREE.MeshBasicMaterial({
    color: 0x222222,
    side: THREE.DoubleSide,
  });
  horizon = new THREE.Mesh(horizonGeom, horizonMat);
  horizon.rotation.x = Math.PI / 2;
  scene.add(horizon);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  // Create a tooltip for hover info
  tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "5px 10px";
  tooltip.style.background = "rgba(0,0,0,0.7)";
  tooltip.style.color = "#fff";
  tooltip.style.borderRadius = "3px";
  tooltip.style.display = "none";
  tooltip.style.pointerEvents = "none";
  document.body.appendChild(tooltip);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);

  animate();
}

export function updateScene(latitude, longitude, dateTime) {
  if (!scene) return;

  const time = Astronomy.MakeTime(dateTime);
  const observer = new Astronomy.Observer(latitude, longitude, 0);

  // We keep the code that calculates altitude/azimuth as before.
  const results = [];
  for (const body of planetNames) {
    const equ = Astronomy.Equator(body, time, observer, false, true);
    const hor = Astronomy.Horizon(time, observer, equ.ra, equ.dec, "normal");
    if (hor.altitude > 0) {
      results.push({ name: body, alt: hor.altitude, az: hor.azimuth });
    }
  }

  // -- [2] For the Sun, we keep the same approach for light direction,
  //        but no changes needed, just re-inject it:
  const sunEqu = Astronomy.Equator("Sun", time, observer, false, true);
  const sunHor = Astronomy.Horizon(
    time,
    observer,
    sunEqu.ra,
    sunEqu.dec,
    "normal"
  );
  const sunAlt = THREE.MathUtils.degToRad(sunHor.altitude);
  let sunAz = THREE.MathUtils.degToRad(sunHor.azimuth);
  sunAz = -sunAz;
  const R_sun = 4; // internal base radius for the sun’s lighting
  const sy = R_sun * Math.sin(sunAlt);
  const sr = R_sun * Math.cos(sunAlt);
  const sx = sr * Math.sin(sunAz);
  const sz = sr * Math.cos(sunAz);

  // Remove old directional lights
  const oldLights = scene.children.filter(
    (c) => c.isLight && c.type === "DirectionalLight"
  );
  oldLights.forEach((l) => scene.remove(l));

  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    SUN_LIGHT_INTENSITY
  );
  directionalLight.position.set(sx, sy, sz).normalize();
  scene.add(directionalLight);

  // -- [3] Hide all old planet meshes if not visible
  const visibleNames = results.map((p) => p.name);
  for (const name in planetAndMoons) {
    if (!visibleNames.includes(name)) {
      planetAndMoons[name].mesh.visible = false;
      if (planetAndMoons[name].ringMesh)
        planetAndMoons[name].ringMesh.visible = false;
      planetAndMoons[name].moons.forEach((m) => (m.visible = false));
    }
  }

  // -- [4] Instead of using a single R=4 for all planets,
  //        fetch a per-planet "fake" distance from planetDistanceMap.
  for (const p of results) {
    const alt = THREE.MathUtils.degToRad(p.alt);
    let az = THREE.MathUtils.degToRad(p.az);
    az = -az; // so it doesn't get mirrored

    // This is the "base" distance from Earth for each planet
    // Default to 4 if not found in the map
    const planetDist = planetDistanceMap[p.name] || 4.0;

    const y = planetDist * Math.sin(alt);
    const r = planetDist * Math.cos(alt);
    const x = r * Math.sin(az);
    const z = r * Math.cos(az);

    // The rest of the code for creating or positioning planets is unchanged.
    const data = planetData[p.name] || { size: 0.1, moons: [], hasRing: false };
    let tex = null;
    if (textureMap[p.name]) {
      if (!loadedTextures[p.name]) {
        loadedTextures[p.name] = textureLoader.load(
          `/textures/${textureMap[p.name]}`
        );
      }
      tex = loadedTextures[p.name];
    }

    const isSun = p.name === "Sun";
    if (!planetAndMoons[p.name]) {
      const planetMesh = isSun
        ? createBrightSphere(data.size, tex, x, y, z, p.name)
        : createSphere(data.size, tex, x, y, z, p.name);
      scene.add(planetMesh);

      let ringMesh = null;
      if (data.hasRing) {
        const ringInnerRadius = data.size * RING_INNER_FACTOR;
        const ringOuterRadius = data.size * RING_OUTER_FACTOR;
        const ringGeom = new THREE.RingGeometry(
          ringInnerRadius,
          ringOuterRadius,
          64
        );
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xcfc7b2,
          side: THREE.DoubleSide,
          opacity: 0.8,
          transparent: true,
        });
        ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 3;
        ringMesh.position.set(x, y, z);
        ringMesh.userData.label = p.name + " Rings";
        scene.add(ringMesh);
      }

      const moonMeshes = [];
      if (data.moons && data.moons.length > 0) {
        const moonTex =
          loadedTextures["Moon"] ||
          (loadedTextures["Moon"] = textureLoader.load(
            "/textures/2k_moon.jpg"
          ));
        const moonOrbitRadius = data.size * MOON_ORBIT_FACTOR;
        data.moons.forEach((moonName, idx) => {
          const angle = ((2 * Math.PI) / data.moons.length) * idx;
          const mx = x + moonOrbitRadius * Math.cos(angle);
          const my = y;
          const mz = z + moonOrbitRadius * Math.sin(angle);
          const moonMesh = createSphere(
            MOON_SIZE,
            moonTex,
            mx,
            my,
            mz,
            moonName
          );
          scene.add(moonMesh);
          moonMeshes.push(moonMesh);
        });
      }

      planetAndMoons[p.name] = {
        mesh: planetMesh,
        ringMesh: ringMesh,
        moons: moonMeshes,
      };
    } else {
      const entry = planetAndMoons[p.name];
      entry.mesh.position.set(x, y, z);
      entry.mesh.visible = true;
      if (
        isSun &&
        entry.mesh.material &&
        !(entry.mesh.material instanceof THREE.MeshBasicMaterial)
      ) {
        entry.mesh.material = new THREE.MeshBasicMaterial({ map: tex });
      }
      if (entry.ringMesh) {
        entry.ringMesh.position.set(x, y, z);
        entry.ringMesh.visible = true;
      }

      if (data.moons && data.moons.length > 0) {
        const moonOrbitRadius = data.size * MOON_ORBIT_FACTOR;
        data.moons.forEach((moonName, idx) => {
          const angle = ((2 * Math.PI) / data.moons.length) * idx;
          const mx = x + moonOrbitRadius * Math.cos(angle);
          const my = y;
          const mz = z + moonOrbitRadius * Math.sin(angle);
          const moonMesh = entry.moons[idx];
          moonMesh.position.set(mx, my, mz);
          moonMesh.visible = true;
        });
      }
    }
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createSphere(size, texture, x, y, z, label) {
  const sphereGeom = new THREE.SphereGeometry(size, 32, 32);
  const sphereMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(sphereGeom, sphereMat);
  mesh.position.set(x, y, z);
  mesh.userData.label = label;
  return mesh;
}

function createBrightSphere(size, texture, x, y, z, label) {
  const sphereGeom = new THREE.SphereGeometry(size, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(sphereGeom, sphereMat);
  mesh.position.set(x, y, z);
  mesh.userData.label = label;
  return mesh;
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function onMouseMove(event) {
  if (!renderer || !camera) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const allMeshes = [];
  for (const name in planetAndMoons) {
    if (planetAndMoons[name].mesh?.visible)
      allMeshes.push(planetAndMoons[name].mesh);
    if (planetAndMoons[name].ringMesh?.visible)
      allMeshes.push(planetAndMoons[name].ringMesh);
    planetAndMoons[name].moons.forEach((m) => {
      if (m.visible) allMeshes.push(m);
    });
  }

  const intersects = raycaster.intersectObjects(allMeshes, true);

  if (intersects.length > 0) {
    const intersected = intersects[0].object;
    tooltip.textContent = intersected.userData.label || "";
    tooltip.style.display = "block";
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
  } else {
    tooltip.style.display = "none";
  }
}
