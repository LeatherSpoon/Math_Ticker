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
let ground = null;
let keyLight = null;
let fillLight = null;
let rimLight = null;

const nodes = [];
const enemies = [];
const environmentGroups = {};
let environmentLightRig = null;

const ENVIRONMENT_STYLES = {
  'Landing Site': {
    groundColor: 0x7cad5d,
    background: 0x6b9ecf,
    fog: [0x84b4df, 0.01],
    light: { key: [0xfff6d9, 1.08], fill: [0xd9f2ff, 0.6], rim: [0xc6ecff, 0.3] },
  },
  Mine: {
    groundColor: 0x5c5b54,
    background: 0x1f242d,
    fog: [0x20262f, 0.055],
    light: { key: [0xffd39a, 0.7], fill: [0x8ec0ff, 0.25], rim: [0xffa15a, 0.5] },
  },
  'Verdant Maw': {
    groundColor: 0x3a7f46,
    background: 0x5a8f73,
    fog: [0x446f57, 0.02],
    light: { key: [0xe4ffce, 0.95], fill: [0x9adca6, 0.75], rim: [0x8bf5ab, 0.32] },
  },
  'Lagoon Coast': {
    groundColor: 0xb4c788,
    background: 0x7ad1df,
    fog: [0x88dbe3, 0.015],
    light: { key: [0xfff3cf, 1], fill: [0xb9efff, 0.68], rim: [0x6de6ff, 0.45] },
  },
};

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

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function makeTree() {
  const tree = new THREE.Group();
  const trunk = stylizedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.7, 6), 0x70503a);
  trunk.position.y = 0.85;
  const canopy = stylizedMesh(new THREE.ConeGeometry(0.95, 1.5, 7), 0x3f8342);
  canopy.position.y = 2;
  tree.add(trunk, canopy);
  return tree;
}

function makeRock(scale = 1) {
  const rock = stylizedMesh(new THREE.DodecahedronGeometry(0.45 * scale, 0), 0x767676);
  rock.rotation.set(randomRange(-0.25, 0.25), randomRange(0, Math.PI), randomRange(-0.2, 0.2));
  return rock;
}

function makeMeadowClutter() {
  const clutter = new THREE.Group();
  const blades = stylizedMesh(new THREE.ConeGeometry(0.15, 0.5, 5), 0x6aa94f);
  blades.position.y = 0.22;
  const flower = stylizedMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xf1df93);
  flower.position.y = 0.45;
  clutter.add(blades, flower);
  clutter.rotation.y = randomRange(0, Math.PI * 2);
  return clutter;
}

function buildLandingSiteProps() {
  const group = new THREE.Group();
  group.name = 'LandingSiteProps';

  const perimeterRadius = 52;
  for (let i = 0; i < 36; i += 1) {
    const tree = makeTree();
    const angle = (i / 36) * Math.PI * 2;
    const radiusJitter = randomRange(-8, 7);
    tree.position.set(
      Math.cos(angle) * (perimeterRadius + radiusJitter),
      0,
      Math.sin(angle) * (perimeterRadius + radiusJitter)
    );
    tree.scale.setScalar(randomRange(0.9, 1.35));
    group.add(tree);
  }

  for (let i = 0; i < 80; i += 1) {
    const clutter = makeMeadowClutter();
    clutter.position.set(randomRange(-30, 30), 0, randomRange(-24, 24));
    clutter.scale.setScalar(randomRange(0.7, 1.2));
    group.add(clutter);
  }

  const ridge = new THREE.Group();
  for (let i = 0; i < 14; i += 1) {
    const peak = stylizedMesh(
      new THREE.ConeGeometry(randomRange(2.5, 4.2), randomRange(6, 10), 5),
      0x5f6e77
    );
    peak.position.set(-58 + i * 9.5, randomRange(2.3, 3.4), -44 - randomRange(0, 6));
    ridge.add(peak);
  }
  group.add(ridge);

  const cave = new THREE.Group();
  const arch = stylizedMesh(new THREE.TorusGeometry(2.4, 0.65, 8, 16, Math.PI), 0x4f4b45);
  arch.rotation.z = Math.PI;
  arch.position.set(-18, 2.2, -20);
  const cavity = stylizedMesh(new THREE.CylinderGeometry(1.5, 1.5, 2.2, 10, 1, true), 0x242424);
  cavity.rotation.x = Math.PI / 2;
  cavity.position.set(-18, 1.05, -18.7);
  cave.add(arch, cavity);
  group.add(cave);
  return group;
}

function buildMineProps() {
  const group = new THREE.Group();
  group.name = 'MineProps';

  const tunnelWall = stylizedMesh(new THREE.BoxGeometry(80, 12, 4), 0x3b3936);
  tunnelWall.position.set(0, 5, -22);
  group.add(tunnelWall);

  for (let i = 0; i < 22; i += 1) {
    const support = new THREE.Group();
    const beamLeft = stylizedMesh(new THREE.BoxGeometry(0.5, 3.3, 0.5), 0x6a503a);
    const beamRight = stylizedMesh(new THREE.BoxGeometry(0.5, 3.3, 0.5), 0x6a503a);
    const beamTop = stylizedMesh(new THREE.BoxGeometry(3.3, 0.4, 0.5), 0x7b5d40);
    beamLeft.position.set(-1.4, 1.7, 0);
    beamRight.position.set(1.4, 1.7, 0);
    beamTop.position.set(0, 3.2, 0);
    support.add(beamLeft, beamRight, beamTop);
    support.position.set(-32 + i * 3, 0, randomRange(-7, 7));
    support.rotation.y = randomRange(-0.08, 0.08);
    group.add(support);
  }

  for (let i = 0; i < 30; i += 1) {
    const debris = makeRock(randomRange(0.75, 1.35));
    debris.position.set(randomRange(-34, 34), 0.25, randomRange(-18, 18));
    group.add(debris);
  }

  const veinCluster = new THREE.Group();
  for (let i = 0; i < 10; i += 1) {
    const crystal = stylizedMesh(new THREE.ConeGeometry(0.25, randomRange(0.7, 1.4), 6), 0x8ec0ff);
    crystal.position.set(randomRange(-8, 8), randomRange(0.3, 1.1), -14 + randomRange(-2, 2));
    crystal.rotation.y = randomRange(0, Math.PI * 2);
    veinCluster.add(crystal);
  }
  group.add(veinCluster);

  const caveMouth = stylizedMesh(new THREE.TorusGeometry(4, 1.3, 8, 18, Math.PI), 0x49443d);
  caveMouth.rotation.z = Math.PI;
  caveMouth.position.set(0, 3, 23);
  group.add(caveMouth);

  return group;
}

function buildEnvironmentProps(environmentName) {
  switch (environmentName) {
    case 'Mine':
      return buildMineProps();
    case 'Landing Site':
      return buildLandingSiteProps();
    default:
      return new THREE.Group();
  }
}

function setActiveEnvironmentGroup(environmentName) {
  Object.entries(environmentGroups).forEach(([name, group]) => {
    group.visible = name === environmentName;
  });

  if (!environmentGroups[environmentName]) {
    const newGroup = buildEnvironmentProps(environmentName);
    environmentGroups[environmentName] = newGroup;
    scene.add(newGroup);
  }
  environmentGroups[environmentName].visible = true;
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

  keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(10, 20, 6);
  fillLight = new THREE.HemisphereLight(0xc7ecff, 0x2c3a3a, 0.55);
  rimLight = new THREE.DirectionalLight(0x93d2ff, 0.3);
  rimLight.position.set(-12, 8, -20);
  environmentLightRig = new THREE.Group();
  environmentLightRig.add(keyLight, fillLight, rimLight);
  scene.add(environmentLightRig);

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

  spawnNode('copper', -8, -5, 0xc17f43);
  spawnNode('timber', 7, 4, 0x5d8f3a);
  spawnNode('stone', 2, -7, 0x999999);
  spawnNode('fiber', -10, 6, 0xb6db82);
  spawnEnemy('Scrapper', 10, -2);
  spawnEnemy('Scrapper', -4, 8);
  setActiveEnvironmentGroup(state.env);

  game3DAvailable = true;
  degradedMode = false;
}

function applyEnvironmentTint() {
  if (!ground || !scene || !keyLight || !fillLight || !rimLight) return;
  const style = ENVIRONMENT_STYLES[state.env] || ENVIRONMENT_STYLES['Landing Site'];
  ground.material.color.setHex(style.groundColor);
  scene.background.setHex(style.background);
  scene.fog = new THREE.FogExp2(style.fog[0], style.fog[1]);
  keyLight.color.setHex(style.light.key[0]);
  keyLight.intensity = style.light.key[1];
  fillLight.color.setHex(style.light.fill[0]);
  fillLight.intensity = style.light.fill[1];
  rimLight.color.setHex(style.light.rim[0]);
  rimLight.intensity = style.light.rim[1];
  setActiveEnvironmentGroup(state.env);
}

function wireUI() {
  if (wireUI.didInit) return;
  wireUI.didInit = true;

  document.getElementById('upgradeDrone').addEventListener('click', () => {
    const cost = state.droneLevel * 250;
    if (state.pp >= cost) {
      state.pp -= cost;
      state.droneLevel += 1;
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
let last = performance.now();

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
  } else if (combat) {
    combat.fp = Math.min(combat.fpMax, combat.fp + state.stats.focusRate * 8 * dt);
    combat.enemyCooldown -= dt;
    if (combat.enemyCooldown <= 0) {
      combat.enemyCooldown = 2;
      const incoming = Math.max(1, combat.enemy.userData.attack - state.stats.defense * 0.35);
      combat.playerHP -= incoming;
      logCombat(`${combat.enemy.userData.name} hit for ${Math.ceil(incoming)}.`);
      if (combat.playerHP <= 0) {
        combat.playerHP = 1;
        logCombat('Rescue drone extracted you to Landing Site.');
        state.env = 'Landing Site';
        applyEnvironmentTint();
        closeCombat(false);
      }
    }
    updateCombatBars();
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
