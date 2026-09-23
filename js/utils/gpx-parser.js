export function parseGpx(gpxText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, 'application/xml');

  const points = [...doc.querySelectorAll('trkpt')].map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: parseFloat(pt.querySelector('ele')?.textContent || 0)
  }));

  if (points.length < 2) return null;

  // Window=3 removes isolated GPS spikes; profile uses these smoothed values
  const smoothed = smoothElevation(points, 3);

  let totalDist = 0;
  const profile = [{ dist: 0, ele: smoothed[0].ele }];
  for (let i = 1; i < points.length; i++) {
    totalDist += haversine(points[i - 1], points[i]);
    profile.push({ dist: totalDist, ele: smoothed[i].ele });
  }

  // Threshold hysteresis: only commit a change once it exceeds threshold from
  // last ref point. window=3 pre-smoothing removes spikes, threshold=2 removes
  // remaining micro-oscillations without cutting real climbs.
  const { gain: elevGain, loss: elevLoss } = calcElevationThreshold(smoothed, 1.5);

  const minEle = Math.min(...profile.map(p => p.ele));
  const maxEle = Math.max(...profile.map(p => p.ele));

  return {
    distanceKm: Math.round(totalDist / 10) / 100,
    elevationGainM: Math.round(elevGain),
    elevationLossM: Math.round(elevLoss),
    minElevationM: Math.round(minEle),
    maxElevationM: Math.round(maxEle),
    profile
  };
}

// Découpe le profil en tranches d'1 km : D+/D- et altitudes par kilomètre.
// Sert à donner à l'IA le relief réel du parcours pour bâtir un plan d'allure
// segment par segment plutôt que des généralités.
export function splitByKm(profile, threshold = 1.5) {
  if (!profile || profile.length < 2) return [];

  const totalM = profile[profile.length - 1].dist;
  const kms = [];
  let i = 0;   // curseur : premier point de la tranche courante

  for (let k = 0; k * 1000 < totalM; k++) {
    const endM = Math.min((k + 1) * 1000, totalM);

    // La tranche démarre sur le dernier point du km précédent pour ne pas
    // perdre le dénivelé de la jonction entre deux kilomètres.
    const start = Math.max(0, i - 1);
    while (i < profile.length && profile[i].dist <= endM) i++;
    const pts = profile.slice(start, i);

    if (pts.length < 2) continue;

    const { gain, loss } = calcElevationThreshold(pts, threshold);
    const eles = pts.map(p => p.ele);

    kms.push({
      km:        k + 1,
      lengthM:   Math.round(endM - k * 1000),
      gainM:     Math.round(gain),
      lossM:     Math.round(loss),
      minEleM:   Math.round(Math.min(...eles)),
      maxEleM:   Math.round(Math.max(...eles)),
      startEleM: Math.round(pts[0].ele),
      endEleM:   Math.round(pts[pts.length - 1].ele),
    });
  }

  return kms;
}

function calcElevationThreshold(points, threshold = 5) {
  let gain = 0, loss = 0;
  let ref = points[0].ele;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - ref;
    if (diff >= threshold) {
      gain += diff;
      ref = points[i].ele;
    } else if (diff <= -threshold) {
      loss += Math.abs(diff);
      ref = points[i].ele;
    }
  }
  return { gain, loss };
}

function smoothElevation(points, windowSize = 7) {
  const half = Math.floor(windowSize / 2);
  return points.map((pt, i) => {
    const start = Math.max(0, i - half);
    const end   = Math.min(points.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += points[j].ele;
    return { ...pt, ele: sum / (end - start) };
  });
}

function haversine(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function rad(deg) { return deg * Math.PI / 180; }

// Géométrie partagée par le rendu et le curseur : les deux doivent viser le
// même repère, sinon le point suivi se décale du tracé.
// Le ratio compte : le SVG est affiché en width:100%, donc sur un iPhone un
// viewBox 800×200 ne laissait que ~90 px de haut, presque impossible à viser.
const CHART = { width: 800, height: 300, pad: { top: 16, right: 16, bottom: 34, left: 44 } };

// Le plein écran dispose de plus de hauteur : la géométrie est donc variable,
// mais elle est écrite sur le SVG au rendu et relue par le curseur — les deux
// ne peuvent pas diverger.
function geometry(height = CHART.height) {
  return { ...CHART, height };
}

function chartScales(profile, height = CHART.height) {
  const W = CHART.width - CHART.pad.left - CHART.pad.right;
  const H = height      - CHART.pad.top  - CHART.pad.bottom;
  const maxDist = profile[profile.length - 1].dist;
  const minEle  = Math.min(...profile.map(p => p.ele));
  const maxEle  = Math.max(...profile.map(p => p.ele));
  const eleRange = maxEle - minEle || 1;
  return {
    W, H, maxDist, minEle, maxEle, eleRange,
    toX: d => CHART.pad.left + (d / maxDist) * W,
    toY: e => CHART.pad.top + H - ((e - minEle) / eleRange) * H,
  };
}

// D+ cumulé point par point, même hystérésis que le D+ total : le curseur peut
// ainsi dire « 87 m grimpés à ce stade » sans recalculer à chaque déplacement.
function cumulativeGain(profile, threshold = 1.5) {
  const out = new Array(profile.length).fill(0);
  let gain = 0, ref = profile[0].ele;
  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].ele - ref;
    if (diff >= threshold)       { gain += diff;  ref = profile[i].ele; }
    else if (diff <= -threshold) {                ref = profile[i].ele; }
    out[i] = gain;
  }
  return out;
}

// Le profil est trié par distance : recherche dichotomique plutôt qu'un scan
// de tous les points à chaque mouvement du doigt.
function nearestIndex(profile, dist) {
  let lo = 0, hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].dist < dist) lo = mid; else hi = mid;
  }
  return Math.abs(profile[lo].dist - dist) <= Math.abs(profile[hi].dist - dist) ? lo : hi;
}

// Pente moyenne autour d'un point, sur une fenêtre de ±75 m : la pente entre
// deux points GPS bruts est trop bruitée pour être lisible.
function slopeAt(profile, i, windowM = 75) {
  let a = i, b = i;
  while (a > 0 && profile[i].dist - profile[a].dist < windowM) a--;
  while (b < profile.length - 1 && profile[b].dist - profile[i].dist < windowM) b++;
  const run = profile[b].dist - profile[a].dist;
  return run < 1 ? 0 : ((profile[b].ele - profile[a].ele) / run) * 100;
}

const HINT = '<span class="elevation-readout__hint">Touchez ou survolez le profil pour le détail</span>';

function cell(label, value) {
  return `<span class="elevation-readout__cell"><span class="elevation-readout__label">${label}</span>${value}</span>`;
}

// Curseur interactif. Sur mobile, un simple appui suffit et le repère reste
// affiché quand on relève le doigt ; le scroll vertical de la page continue de
// passer (touch-action: pan-y), seul le glissement horizontal pilote le curseur.
export function attachElevationCursor(container, data, { touch = true } = {}) {
  if (!data?.profile?.length) return;
  const svg = container.querySelector('svg');
  if (!svg) return;

  const { profile } = data;
  const height = parseInt(svg.dataset.chartHeight) || CHART.height;
  const { W, H, maxDist, toX, toY } = chartScales(profile, height);
  const gains = cumulativeGain(profile);
  const ns = 'http://www.w3.org/2000/svg';

  const vLine = document.createElementNS(ns, 'line');
  vLine.setAttribute('y1', CHART.pad.top); vLine.setAttribute('y2', CHART.pad.top + H);
  vLine.setAttribute('stroke', 'var(--text-primary)'); vLine.setAttribute('stroke-width', '1');
  vLine.setAttribute('stroke-dasharray', '4,3'); vLine.style.opacity = '0';
  svg.appendChild(vLine);

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('r', '4'); dot.setAttribute('fill', 'var(--ios-blue)');
  dot.setAttribute('stroke', 'white'); dot.setAttribute('stroke-width', '2');
  dot.style.opacity = '0';
  svg.appendChild(dot);

  // La zone sensible couvre tout le cadre, pas seulement le tracé : viser une
  // bande de quelques dizaines de pixels au doigt est intenable. La position
  // horizontale est de toute façon ramenée dans les bornes du profil.
  const overlay = document.createElementNS(ns, 'rect');
  overlay.setAttribute('x', 0); overlay.setAttribute('y', 0);
  overlay.setAttribute('width', CHART.width); overlay.setAttribute('height', height);
  overlay.setAttribute('fill', 'transparent');
  overlay.style.cursor = 'crosshair';
  overlay.style.touchAction = 'pan-y';   // laisse la page défiler verticalement
  svg.appendChild(overlay);

  // Les valeurs s'affichent sous le graphique plutôt qu'en bulle flottante :
  // une bulle posée sur le tracé en masque une partie, et le doigt cache le
  // reste. Ici rien ne recouvre le profil et la ligne reste lisible.
  const readout = document.createElement('div');
  readout.className = 'elevation-readout';
  readout.innerHTML = HINT;
  container.appendChild(readout);

  let dragging = false;

  function move(clientX, clientY) {
    // getBoundingClientRect renvoie une boîte alignée sur les axes : fausse dès
    // que le graphique est pivoté. La matrice du SVG, elle, suit la rotation.
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const clampedX = Math.min(Math.max(pt.x, CHART.pad.left), CHART.pad.left + W);

    const i = nearestIndex(profile, ((clampedX - CHART.pad.left) / W) * maxDist);
    const p = profile[i];
    const px = toX(p.dist);
    const py = toY(p.ele);

    vLine.setAttribute('x1', px); vLine.setAttribute('x2', px); vLine.style.opacity = '0.5';
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.opacity = '1';

    const slope = slopeAt(profile, i);
    readout.innerHTML =
      cell('Km',    (p.dist / 1000).toFixed(1)) +
      cell('Alt.',  `${Math.round(p.ele)} m`) +
      cell('Pente', `${slope >= 0 ? '+' : ''}${slope.toFixed(1)} %`) +
      cell('D+',    `${Math.round(gains[i])} m`);
  }

  function hide() {
    vLine.style.opacity = '0'; dot.style.opacity = '0';
    readout.innerHTML = HINT;
  }

  overlay.addEventListener('pointerdown', e => {
    if (!touch && e.pointerType !== 'mouse') return;   // l'appui est réservé à l'ouverture du plein écran
    dragging = true;
    overlay.setPointerCapture?.(e.pointerId);
    move(e.clientX, e.clientY);
  });
  overlay.addEventListener('pointermove', e => {
    // Souris : on suit le survol. Doigt : seulement pendant l'appui.
    if (dragging || e.pointerType === 'mouse') move(e.clientX, e.clientY);
  });
  overlay.addEventListener('pointerup',     () => { dragging = false; });
  overlay.addEventListener('pointercancel', () => { dragging = false; });
  // Le repère reste après avoir relevé le doigt ; seule la souris qui quitte
  // le graphique l'efface.
  overlay.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
}

// Pas de graduation rond donnant 4 à 6 repères. L'ancien calcul
// (ceil(km/5)*5) dépassait la distance elle-même : un semi ou un marathon
// n'affichaient qu'un seul repère, « 0km », impossible de s'y situer.
function niceKmStep(maxKm, maxTicks = 6) {
  for (const step of [0.5, 1, 2, 5, 10, 20, 25, 50, 100]) {
    if (maxKm / step <= maxTicks) return step;
  }
  return Math.ceil(maxKm / maxTicks);
}

export function renderElevationChart(profile, { maxTicks = 6, height = CHART.height } = {}) {
  if (!profile || profile.length < 2) return '';

  const { W, H, maxDist, minEle, eleRange, toX, toY } = chartScales(profile, height);
  const { pad, width } = geometry(height);

  const pts = profile.map(p => `${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
  const areaPath = `M${pad.left},${pad.top + H} ` +
    profile.map(p => `L${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ') +
    ` L${pad.left + W},${pad.top + H} Z`;

  // Axe Y + lignes de repère horizontales : sans elles, impossible de situer un
  // point du tracé par rapport à une altitude.
  const steps = 4;
  const yAxis = Array.from({ length: steps + 1 }, (_, i) => {
    const ele = minEle + (eleRange * i / steps);
    const y = toY(ele).toFixed(1);
    return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}" stroke="var(--separator)" stroke-width="0.5"/>` +
           `<text x="${pad.left - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--text-secondary)" font-size="10">${Math.round(ele)}m</text>`;
  }).join('');

  const kmStep = niceKmStep(maxDist / 1000, maxTicks);
  const xAxis = [];
  for (let km = 0; km <= maxDist / 1000; km += kmStep) {
    const x = toX(km * 1000).toFixed(1);
    const label = Number.isInteger(km) ? km : km.toFixed(1).replace('.', ',');
    xAxis.push(
      `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${pad.top + H}" stroke="var(--separator)" stroke-width="0.5"/>` +
      `<text x="${x}" y="${pad.top + H + 16}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${label}km</text>`
    );
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" data-chart-height="${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      <defs>
        <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--ios-blue)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--ios-blue)" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      ${yAxis}
      ${xAxis.join('')}
      <path d="${areaPath}" fill="url(#elev-grad)"/>
      <polyline points="${pts}" fill="none" stroke="var(--ios-blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}
