const canvas = document.getElementById('gameCanvas');
let renderer = null;
let scene = null;
let camera = null;
let game3DAvailable = false;
let degradedMode = false;

const state = {
  running: true,
  pp: 0,
  ppRate: 1,
  steps: 0,
  stepBonus: 0.03,
  env: 'Landing Site',
  droneLevel: 1,
  droneTarget: 'copper',
  resources: { copper: 0, timber: 0, stone: 0, fiber: 0, resin: 0, quartz: 0 },
  inventory: { ration: 0, firstAid: 0 },
  unlocks: { 'Landing Site': true, Mine: true, 'Verdant Maw': false, 'Lagoon Coast': false },
  stats: {
    strength: 5,
    health: 100,
    defense: 3,
    constitution: 2,
    dexterity: 2,
    agility: 2,
    perception: 2,
    focusRate: 2,
    focus: 100,
    crafting: 1,
    craftingSpeed: 1,
    speed: 7,
  },
  playerHP: 100,
  inCombat: false,
};

const statCosts = Object.fromEntries(Object.keys(state.stats).map((k) => [k, 20]));

let player = null;
let drone = null;
let ground = null;

const nodes = [];
const enemies = [];

function stylizedMesh(geometry, color) {
  const body = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.08 })
  );
  body.castShadow = true;

  const outline = new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide })
  );
  outline.scale.multiplyScalar(1.06);

  const group = new THREE.Group();
  group.add(body, outline);
  return group;
}

let warnedLimbFallback = false;
function makeLimbGeometry(radius, length) {
  if (typeof THREE.CapsuleGeometry === 'function') {
    return new THREE.CapsuleGeometry(radius, length, 6, 10);
  }
  if (!warnedLimbFallback) {
    console.warn('[geometry] THREE.CapsuleGeometry unavailable; using CylinderGeometry fallback for limbs.');
    warnedLimbFallback = true;
  }
  return new THREE.CylinderGeometry(radius, radius, length + radius * 2, 10);
}

function buildPlayerPlaceholder() {
  const g = new THREE.Group();
  const body = stylizedMesh(new THREE.BoxGeometry(1, 1.6, 1), 0x87b8df);
  body.position.y = 1.2;
  const head = stylizedMesh(new THREE.SphereGeometry(0.35, 12, 10), 0xf2dcc5);
  head.position.y = 2.3;
  g.add(body, head);
  return g;
}

function buildCyborg() {
  const g = new THREE.Group();

  const torso = stylizedMesh(new THREE.BoxGeometry(1.1, 1.5, 0.8), 0x87b8df);
  torso.position.y = 1.5;
  g.add(torso);

  const head = stylizedMesh(new THREE.SphereGeometry(0.45, 16, 14), 0xf2dcc5);
  head.position.y = 2.6;
  g.add(head);

  const legL = stylizedMesh(makeLimbGeometry(0.22, 0.7), 0x4e6078);
  const legR = stylizedMesh(makeLimbGeometry(0.22, 0.7), 0x4e6078);
  legL.position.set(-0.25, 0.55, 0);
  legR.position.set(0.25, 0.55, 0);
  g.add(legL, legR);

  const armL = stylizedMesh(makeLimbGeometry(0.16, 0.72), 0x4e6078);
  const armR = stylizedMesh(makeLimbGeometry(0.16, 0.72), 0x4e6078);
  armL.rotation.z = 0.25;
  armR.rotation.z = -0.25;
  armL.position.set(-0.8, 1.55, 0);
  armR.position.set(0.8, 1.55, 0);
  g.add(armL, armR);

  return g;
}

function buildDrone(level = state.droneLevel) {
  const g = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 12),
    new THREE.MeshStandardMaterial({
      color: 0x9fe8ff,
      emissive: 0x4bc2ff,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.75,
    })
  );
  core.castShadow = true;
  g.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.07, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8ad7ff,
      emissive: 0x3caeff,
      emissiveIntensity: 0.8,
      roughness: 0.4,
      metalness: 0.3,
    })
  );
  halo.rotation.x = Math.PI / 2;
  g.add(halo);

  const attachmentRoot = new THREE.Group();
  g.add(attachmentRoot);

  g.userData = {
    core,
    halo,
    attachmentRoot,
    orbitAngle: 0,
    gatherPulse: 0,
    gatherCooldown: 0,
    rescueLock: false,
  };

  setDroneVisualLevel(level);
  return g;
}

function setDroneVisualLevel(level = state.droneLevel) {
  if (!drone || !drone.userData?.core || !drone.userData?.halo || !drone.userData?.attachmentRoot) return;
  const { core, halo, attachmentRoot } = drone.userData;

  const clampedLevel = Math.max(1, level);
  const baseScale = 0.82 + clampedLevel * 0.12;
  drone.scale.setScalar(baseScale);

  core.material.emissiveIntensity = 0.45 + clampedLevel * 0.16;
  halo.material.emissiveIntensity = 0.6 + clampedLevel * 0.14;
  halo.scale.setScalar(1 + clampedLevel * 0.05);

  attachmentRoot.clear();
  const podCount = Math.min(6, 1 + clampedLevel);
  for (let i = 0; i < podCount; i += 1) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0xb9d5e3, roughness: 0.4, metalness: 0.65 })
    );
    const pod = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x97ffe0, emissive: 0x32cc9c, emissiveIntensity: 0.4 })
    );
    const angle = (i / podCount) * Math.PI * 2;
    arm.position.set(Math.cos(angle) * 0.62, 0, Math.sin(angle) * 0.62);
    arm.lookAt(0, 0, 0);
    arm.rotateX(Math.PI / 2);
    pod.position.set(Math.cos(angle) * 0.88, (i % 2 ? 0.08 : -0.08), Math.sin(angle) * 0.88);
    attachmentRoot.add(arm, pod);
  }
}

function spawnNode(type, x, z, color) {
  const node = stylizedMesh(new THREE.DodecahedronGeometry(0.8, 0), color);
  node.position.set(x, 0.8, z);
  node.userData = { type };
  scene.add(node);
  nodes.push(node);
}

function spawnEnemy(name, x, z) {
  const e = new THREE.Group();
  const body = stylizedMesh(new THREE.CylinderGeometry(0.5, 0.65, 1.4, 8), 0x9f6e74);
  body.position.y = 1;
  e.add(body);
  e.position.set(x, 0, z);
  e.userData = { name, hp: 60, maxHp: 60, attack: 4 };
  scene.add(e);
  enemies.push(e);
}

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', () => {
  if (!renderer) return;
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
});

const ui = {
  pp: document.getElementById('pp'),
  ppRate: document.getElementById('ppRate'),
  steps: document.getElementById('steps'),
  resourceSummary: document.getElementById('resourceSummary'),
  statList: document.getElementById('statList'),
  droneLevel: document.getElementById('droneLevel'),
  droneTarget: document.getElementById('droneTarget'),
  inventory: document.getElementById('inventory'),
  envLabel: document.getElementById('environmentLabel'),
  envButtons: document.getElementById('environmentButtons'),
  droneResourceButtons: document.getElementById('droneResourceButtons'),
};

function showBootError(message) {
  let panel = document.getElementById('bootErrorPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'bootErrorPanel';
    panel.style.position = 'fixed';
    panel.style.top = '12px';
    panel.style.left = '12px';
    panel.style.zIndex = '9999';
    panel.style.maxWidth = '360px';
    panel.style.padding = '10px 12px';
    panel.style.border = '1px solid rgba(255,120,120,0.95)';
    panel.style.background = 'rgba(30, 10, 10, 0.92)';
    panel.style.color = '#ffd9d9';
    panel.style.font = '600 12px/1.35 system-ui, sans-serif';
    panel.style.borderRadius = '8px';
    panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
    document.body.appendChild(panel);
  }
  panel.textContent = message;
}

function renderUI() {
  ui.pp.textContent = state.pp.toFixed(1);
  ui.ppRate.textContent = `(+${state.ppRate.toFixed(2)}/s)`;
  ui.steps.textContent = Math.floor(state.steps);
  ui.resourceSummary.textContent = `copper ${state.resources.copper}, timber ${state.resources.timber}, stone ${state.resources.stone}`;
  ui.droneLevel.textContent = String(state.droneLevel);
  ui.droneTarget.textContent = state.droneTarget;
  ui.inventory.textContent = `ration ${state.inventory.ration}, first aid ${state.inventory.firstAid}`;
  ui.envLabel.textContent = degradedMode ? `${state.env} (Degraded mode: 3D unavailable)` : state.env;

  ui.statList.innerHTML = '';
  Object.entries(state.stats).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const cost = statCosts[key];
    row.innerHTML = `<span>${key}</span><span>${value}</span><button>+ (${cost} PP)</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (state.pp >= cost) {
        state.pp -= cost;
        state.stats[key] += key === 'health' || key === 'focus' ? 10 : 1;
        statCosts[key] = Math.ceil(cost * 1.2);
        state.ppRate += 0.05;
        if (key === 'health') state.playerHP = Math.min(state.playerHP + 10, state.stats.health);
        renderUI();
      }
    });
    ui.statList.appendChild(row);
  });

  ui.envButtons.innerHTML = '';
  const unlockRules = [
    ['Landing Site', 0],
    ['Mine', 0],
    ['Verdant Maw', 1000],
    ['Lagoon Coast', 9000],
  ];

  unlockRules.forEach(([name, need]) => {
    if (state.pp >= need) state.unlocks[name] = true;
    const button = document.createElement('button');
    button.textContent = state.unlocks[name] ? `Travel: ${name}` : `Locked: ${name} (${need} PP)`;
    button.disabled = !state.unlocks[name];
    button.addEventListener('click', () => {
      state.env = name;
      applyEnvironmentTint();
      renderUI();
    });
    ui.envButtons.appendChild(button);
  });
}

let uiHealthy = true;
function safeRenderUI() {
  if (!uiHealthy) return;
  try {
    renderUI();
  } catch (error) {
    uiHealthy = false;
    showBootError('Game failed to initialize. Open console for details.');
    console.error(error);
  }
}

function initGame() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6b9ecf);

  camera = new THREE.OrthographicCamera(-22, 22, 14, -14, 0.1, 100);
  camera.position.set(18, 20, 18);
  camera.lookAt(0, 0, 0);

  const light = new THREE.DirectionalLight(0xffffff, 1.1);
  light.position.set(10, 20, 6);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x7cad5d })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  player = buildCyborg();
  player.position.set(0, 0, 0);
  scene.add(player);

  drone = buildDrone();
  drone.position.set(1.8, 2.3, -1.5);
  scene.add(drone);

  spawnNode('copper', -8, -5, 0xc17f43);
  spawnNode('timber', 7, 4, 0x5d8f3a);
  spawnNode('stone', 2, -7, 0x999999);
  spawnNode('fiber', -10, 6, 0xb6db82);
  spawnEnemy('Scrapper', 10, -2);
  spawnEnemy('Scrapper', -4, 8);

  game3DAvailable = true;
  degradedMode = false;
}

function applyEnvironmentTint() {
  if (!ground || !scene) return;
  const map = {
    'Landing Site': [0x7cad5d, 0x6b9ecf],
    Mine: [0x656565, 0x505e69],
    'Verdant Maw': [0x3a7f46, 0x5a8f73],
    'Lagoon Coast': [0xb4c788, 0x7ad1df],
  };
  const [groundColor, bg] = map[state.env] || map['Landing Site'];
  ground.material.color.setHex(groundColor);
  scene.background.setHex(bg);
}

function wireUI() {
  if (wireUI.didInit) return;
  wireUI.didInit = true;

  document.getElementById('upgradeDrone').addEventListener('click', () => {
    const cost = state.droneLevel * 250;
    if (state.pp >= cost) {
      state.pp -= cost;
      state.droneLevel += 1;
      setDroneVisualLevel(state.droneLevel);
      renderUI();
    }
  });

  ['copper', 'timber', 'stone', 'fiber', 'resin', 'quartz'].forEach((r) => {
    const b = document.createElement('button');
    b.textContent = r;
    b.addEventListener('click', () => {
      state.droneTarget = r;
      renderUI();
    });
    ui.droneResourceButtons.appendChild(b);
  });

  document.querySelectorAll('[data-craft]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.getAttribute('data-craft');
      const recipes = {
        ration: { copper: 1, fiber: 1 },
        firstAid: { copper: 2, resin: 1 },
      };
      const recipe = recipes[item];
      if (!recipe) return;
      const canCraft = Object.entries(recipe).every(([key, amt]) => state.resources[key] >= amt);
      if (!canCraft) return;
      Object.entries(recipe).forEach(([key, amt]) => { state.resources[key] -= amt; });
      state.inventory[item] += 1;
      renderUI();
    });
  });
}
wireUI.didInit = false;

let combat = null;
const combatModal = document.getElementById('combatModal');
const combatLog = document.getElementById('combatLog');
const playerHpBar = document.getElementById('playerHpBar');
const enemyHpBar = document.getElementById('enemyHpBar');
const playerHpText = document.getElementById('playerHpText');
const enemyHpText = document.getElementById('enemyHpText');
const focusRing = document.getElementById('focusRing');
const focusText = document.getElementById('focusText');
const submenu = document.getElementById('subMenu');

const r = 50;
const circumference = 2 * Math.PI * r;
focusRing.style.strokeDasharray = `${circumference}`;

function openCombat(enemy) {
  state.inCombat = true;
  combat = {
    enemy,
    enemyHP: enemy.userData.hp,
    enemyMax: enemy.userData.maxHp,
    playerHP: state.playerHP,
    fp: 0,
    fpMax: state.stats.focus,
    enemyCooldown: 2,
  };
  combatModal.classList.remove('hidden');
  logCombat(`${enemy.userData.name} engaged!`);
  submenu.innerHTML = '';
  updateCombatBars();
}

function closeCombat(victory = false) {
  state.inCombat = false;
  state.playerHP = Math.max(1, combat.playerHP);
  if (victory) {
    const reward = 80;
    state.pp += reward;
    state.ppRate += 0.03;
    scene.remove(combat.enemy);
    const idx = enemies.indexOf(combat.enemy);
    if (idx >= 0) enemies.splice(idx, 1);
    logCombat(`Victory! +${reward} PP`);
  }
  combat = null;
  setTimeout(() => combatModal.classList.add('hidden'), 800);
  renderUI();
}

function logCombat(text) {
  const p = document.createElement('p');
  p.textContent = text;
  combatLog.prepend(p);
}

function updateCombatBars() {
  if (!combat) return;
  const pPct = (combat.playerHP / state.stats.health) * 100;
  const ePct = (combat.enemyHP / combat.enemyMax) * 100;
  playerHpBar.style.width = `${Math.max(0, pPct)}%`;
  enemyHpBar.style.width = `${Math.max(0, ePct)}%`;
  playerHpText.textContent = `HP: ${Math.ceil(combat.playerHP)}/${state.stats.health}`;
  enemyHpText.textContent = `HP: ${Math.ceil(combat.enemyHP)}/${combat.enemyMax}`;
  const ratio = Math.min(1, combat.fp / combat.fpMax);
  focusRing.style.strokeDashoffset = `${circumference * (1 - ratio)}`;
  focusText.textContent = `${Math.floor(combat.fp)}/${combat.fpMax}`;
}

document.querySelectorAll('.combat-bottom button').forEach((b) => {
  b.addEventListener('click', () => handleCombatAction(b.dataset.action));
});

function handleCombatAction(action) {
  if (!combat) return;
  if (action === 'fight') {
    dealDamage(state.stats.strength);
  }
  if (action === 'items') {
    submenu.innerHTML = '';
    const useRation = document.createElement('button');
    useRation.textContent = `Use ration (${state.inventory.ration})`;
    useRation.onclick = () => {
      if (state.inventory.ration > 0) {
        state.inventory.ration -= 1;
        combat.playerHP = Math.min(state.stats.health, combat.playerHP + 20);
        logCombat('Used ration (+20 HP).');
        updateCombatBars();
      }
    };
    const useAid = document.createElement('button');
    useAid.textContent = `Use first aid (${state.inventory.firstAid})`;
    useAid.onclick = () => {
      if (state.inventory.firstAid > 0) {
        state.inventory.firstAid -= 1;
        combat.playerHP = Math.min(state.stats.health, combat.playerHP + 60);
        logCombat('Used first aid (+60 HP).');
        updateCombatBars();
      }
    };
    submenu.append(useRation, useAid);
  }

  if (action === 'run') {
    const chance = Math.min(0.9, 0.35 + state.stats.agility * 0.06);
    if (Math.random() < chance) {
      logCombat('Escaped successfully.');
      closeCombat(false);
    } else {
      logCombat('Failed to escape.');
    }
  }

  if (action === 'skills') {
    submenu.innerHTML = '';
    const skills = [
      ['Jab', 20, 2],
      ['Heavy Hit', 100, 4],
      ['Kinetic Driver', 200, 5],
      ['Ballistic Lunge', 300, 6],
      ['Ion Beam', 500, 7],
      ['Scan', 100, 0],
    ];
    skills.forEach(([name, fpCost, mult]) => {
      const sb = document.createElement('button');
      sb.textContent = `${name} (${fpCost} FP)`;
      sb.onclick = () => {
        if (combat.fp < fpCost) {
          logCombat(`Not enough FP for ${name}.`);
          return;
        }
        combat.fp -= fpCost;
        if (name === 'Scan') {
          logCombat(`Scan: ${combat.enemy.userData.name} HP ${Math.ceil(combat.enemyHP)} / ${combat.enemyMax}`);
          updateCombatBars();
          return;
        }
        dealDamage(state.stats.strength * mult, name);
      };
      submenu.appendChild(sb);
    });
  }
}

function dealDamage(amount, label = 'Fight') {
  combat.enemyHP -= Math.max(1, amount - 0);
  logCombat(`${label} dealt ${Math.ceil(amount)} damage.`);
  if (combat.enemyHP <= 0) {
    updateCombatBars();
    closeCombat(true);
    return;
  }
  updateCombatBars();
}

let droneTimer = 0;
let rescueSequence = null;
let last = performance.now();

function updateDroneFlight(dt) {
  if (!drone || !player || !scene) return;

  drone.userData.orbitAngle += dt * (0.9 + state.droneLevel * 0.08);
  drone.userData.gatherPulse += dt * 2.2;
  drone.userData.gatherCooldown += dt;

  const orbitRadius = 2 + Math.min(2.2, state.droneLevel * 0.17);
  const orbitHeight = 2.1 + Math.sin(drone.userData.gatherPulse) * 0.25;
  const followAnchor = new THREE.Vector3(
    player.position.x + Math.cos(drone.userData.orbitAngle) * orbitRadius,
    orbitHeight,
    player.position.z + Math.sin(drone.userData.orbitAngle) * orbitRadius
  );

  let desired = followAnchor;
  const assignedNodes = nodes.filter((node) => node.userData.type === state.droneTarget);
  let targetNode = null;
  if (assignedNodes.length > 0) {
    targetNode = assignedNodes.reduce((best, node) => {
      if (!best) return node;
      const bestDist = best.position.distanceTo(player.position);
      const nodeDist = node.position.distanceTo(player.position);
      return nodeDist < bestDist ? node : best;
    }, null);
  }

  if (targetNode && drone.userData.gatherCooldown > 1.1) {
    const gatherPoint = new THREE.Vector3(
      targetNode.position.x,
      1.8 + Math.sin(drone.userData.gatherPulse * 1.6) * 0.3,
      targetNode.position.z
    );
    const proximityToPlayer = Math.min(1, targetNode.position.distanceTo(player.position) / 20);
    const gatherWeight = THREE.MathUtils.clamp(0.65 - proximityToPlayer * 0.3, 0.2, 0.65);
    desired = followAnchor.clone().lerp(gatherPoint, gatherWeight);
  }

  const smoothing = THREE.MathUtils.clamp(0.05 + state.droneLevel * 0.012, 0.05, 0.2);
  drone.position.lerp(desired, smoothing);
  drone.lookAt(player.position.x, player.position.y + 1.8, player.position.z);
  drone.rotation.z += Math.sin(drone.userData.gatherPulse) * 0.015;
}

function runRescueSequence(dt) {
  if (!rescueSequence || !drone || !player || !combat) return false;

  rescueSequence.timer += dt;

  if (rescueSequence.phase === 'approach') {
    const pickupPoint = new THREE.Vector3(player.position.x, 1.6, player.position.z);
    drone.position.lerp(pickupPoint, 0.2);
    drone.lookAt(player.position.x, player.position.y + 1.1, player.position.z);
    if (drone.position.distanceTo(pickupPoint) < 0.5 || rescueSequence.timer > 1.25) {
      rescueSequence.phase = 'extract';
      rescueSequence.timer = 0;
      logCombat('Drone lock acquired. Extracting...');
    }
    return true;
  }

  if (rescueSequence.phase === 'extract') {
    rescueSequence.lift = Math.min(1, rescueSequence.lift + dt * 0.65);
    const rise = 3.8 * rescueSequence.lift;
    player.position.y = rise;
    drone.position.set(
      THREE.MathUtils.lerp(drone.position.x, player.position.x + 0.3, 0.25),
      2 + rise,
      THREE.MathUtils.lerp(drone.position.z, player.position.z + 0.3, 0.25)
    );
    if (rescueSequence.timer > 1.75) {
      player.position.set(0, 0, 0);
      state.env = 'Landing Site';
      applyEnvironmentTint();
      rescueSequence = null;
      closeCombat(false);
    }
    return true;
  }

  return false;
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.pp += state.ppRate * dt;

  if (degradedMode) {
    safeRenderUI();
    if (state.running) requestAnimationFrame(tick);
    return;
  }

  if (!game3DAvailable || !player || !scene || !camera || !renderer || !ground) {
    safeRenderUI();
    if (state.running) requestAnimationFrame(tick);
    return;
  }

  if (!state.inCombat) {
    const move = new THREE.Vector3();
    if (keys.has('w') || keys.has('arrowup')) move.z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) move.z += 1;
    if (keys.has('a') || keys.has('arrowleft')) move.x -= 1;
    if (keys.has('d') || keys.has('arrowright')) move.x += 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar((2.2 + state.stats.speed * 0.23) * dt);
      player.position.add(move);
      state.steps += move.length() * 6;
      state.pp += move.length() * state.stepBonus;
    }

    nodes.forEach((node) => {
      node.rotation.y += 0.9 * dt;
      if (node.position.distanceTo(player.position) < 1.4) {
        const type = node.userData.type;
        const gain = 1 + Math.floor(state.stats.perception / 4);
        state.resources[type] += gain;
        state.pp += 3;
        node.position.x = (Math.random() - 0.5) * 24;
        node.position.z = (Math.random() - 0.5) * 16;
      }
    });

    enemies.forEach((enemy) => {
      enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
      if (enemy.position.distanceTo(player.position) < 1.5 && !state.inCombat) {
        openCombat(enemy);
      }
    });

    droneTimer += dt;
    if (droneTimer >= 2.2) {
      droneTimer = 0;
      const yieldAmt = Math.max(1, Math.floor(state.droneLevel * 0.85));
      state.resources[state.droneTarget] += yieldAmt;
      state.pp += 0.5 * state.droneLevel;
    }

    updateDroneFlight(dt);
  } else if (combat) {
    if (runRescueSequence(dt)) {
      updateCombatBars();
    } else {
      combat.fp = Math.min(combat.fpMax, combat.fp + state.stats.focusRate * 8 * dt);
      combat.enemyCooldown -= dt;
      if (combat.enemyCooldown <= 0) {
        combat.enemyCooldown = 2;
        const incoming = Math.max(1, combat.enemy.userData.attack - state.stats.defense * 0.35);
        combat.playerHP -= incoming;
        logCombat(`${combat.enemy.userData.name} hit for ${Math.ceil(incoming)}.`);
        if (combat.playerHP <= 0) {
          combat.playerHP = 1;
          rescueSequence = { phase: 'approach', timer: 0, lift: 0 };
          logCombat('Distress signal sent. Rescue drone inbound...');
        }
      }
      updateCombatBars();
    }
  }

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x + 18, 0.06);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, player.position.z + 18, 0.06);
  camera.lookAt(player.position.x, 0, player.position.z);

  safeRenderUI();
  renderer.render(scene, camera);
  if (state.running) requestAnimationFrame(tick);
}

function boot(preflightError = null) {
  wireUI();

  if (!window.THREE) {
    degradedMode = true;
    game3DAvailable = false;
    if (preflightError) {
      console.error(preflightError);
      showBootError(`3D engine failed to load: ${preflightError?.message || 'unknown error'}`);
    } else {
      showBootError('3D engine failed to load.');
    }
    safeRenderUI();
    requestAnimationFrame(tick);
    return;
  }

  try {
    initGame();
    safeRenderUI();
    applyEnvironmentTint();
    requestAnimationFrame(tick);
  } catch (error) {
    degradedMode = true;
    game3DAvailable = false;
    showBootError(`3D engine failed to load: ${error?.message || 'unknown error'}`);
    console.error(error);
    safeRenderUI();
    requestAnimationFrame(tick);
  }
}

function bootWhenThreeReady() {
  const threeLoad = window.__threeLoad;
  if (!threeLoad || !threeLoad.ready || typeof threeLoad.ready.then !== 'function') {
    boot();
    return;
  }

  threeLoad.ready
    .then(() => {
      boot();
    })
    .catch((error) => {
      boot(error);
    });
}

bootWhenThreeReady();
