export function parseGpx(gpxText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, 'application/xml');

  const points = [...doc.querySelectorAll('trkpt')].map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: parseFloat(pt.querySelector('ele')?.textContent || 0)
  }));

  if (points.length < 2) return null;

  let totalDist = 0;
  let elevGain = 0;
  let elevLoss = 0;
  const profile = [{ dist: 0, ele: points[0].ele }];

  for (let i = 1; i < points.length; i++) {
    totalDist += haversine(points[i - 1], points[i]);
    const dEle = points[i].ele - points[i - 1].ele;
    if (dEle > 0) elevGain += dEle;
    else elevLoss += Math.abs(dEle);
    profile.push({ dist: totalDist, ele: points[i].ele });
  }

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

function haversine(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function rad(deg) { return deg * Math.PI / 180; }

export function attachElevationCursor(container, data, width = 800, height = 200) {
  if (!data?.profile?.length) return;
  const svg = container.querySelector('svg');
  if (!svg) return;

  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const { profile } = data;
  const maxDist = profile[profile.length - 1].dist;
  const minEle  = Math.min(...profile.map(p => p.ele));
  const maxEle  = Math.max(...profile.map(p => p.ele));
  const eleRange = maxEle - minEle || 1;
  const ns = 'http://www.w3.org/2000/svg';

  const vLine = document.createElementNS(ns, 'line');
  vLine.setAttribute('y1', pad.top); vLine.setAttribute('y2', pad.top + H);
  vLine.setAttribute('stroke', 'var(--text-primary)'); vLine.setAttribute('stroke-width', '1');
  vLine.setAttribute('stroke-dasharray', '4,3'); vLine.style.opacity = '0';
  svg.appendChild(vLine);

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('r', '4'); dot.setAttribute('fill', 'var(--ios-blue)');
  dot.setAttribute('stroke', 'white'); dot.setAttribute('stroke-width', '2');
  dot.style.opacity = '0';
  svg.appendChild(dot);

  const overlay = document.createElementNS(ns, 'rect');
  overlay.setAttribute('x', pad.left); overlay.setAttribute('y', pad.top);
  overlay.setAttribute('width', W); overlay.setAttribute('height', H);
  overlay.setAttribute('fill', 'transparent'); overlay.style.cursor = 'crosshair';
  svg.appendChild(overlay);

  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;background:var(--bg-primary);border:1px solid var(--separator);border-radius:8px;padding:4px 10px;font-size:13px;font-weight:600;pointer-events:none;opacity:0;transition:opacity 0.1s;white-space:nowrap;color:var(--text-primary);z-index:10;top:4px;';
  container.style.position = 'relative';
  container.appendChild(tip);

  function move(clientX) {
    const rect = svg.getBoundingClientRect();
    const svgX = (clientX - rect.left) / rect.width * width;
    if (svgX < pad.left || svgX > pad.left + W) { hide(); return; }

    const targetDist = ((svgX - pad.left) / W) * maxDist;
    let closest = profile[0];
    let minD = Infinity;
    for (const p of profile) {
      const d = Math.abs(p.dist - targetDist);
      if (d < minD) { minD = d; closest = p; }
    }

    const px = pad.left + (closest.dist / maxDist) * W;
    const py = pad.top + H - ((closest.ele - minEle) / eleRange) * H;
    vLine.setAttribute('x1', px); vLine.setAttribute('x2', px); vLine.style.opacity = '0.5';
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.opacity = '1';

    tip.textContent = `${(closest.dist / 1000).toFixed(1)} km · ${Math.round(closest.ele)} m`;
    const tipW = tip.offsetWidth || 90;
    const pxScreen = (px / width) * rect.width;
    tip.style.left = `${Math.max(4, Math.min(pxScreen - tipW / 2, rect.width - tipW - 4))}px`;
    tip.style.opacity = '1';
  }

  function hide() {
    vLine.style.opacity = '0'; dot.style.opacity = '0'; tip.style.opacity = '0';
  }

  overlay.addEventListener('pointermove', e => move(e.clientX));
  overlay.addEventListener('pointerleave', hide);
  overlay.addEventListener('touchmove', e => { e.preventDefault(); move(e.touches[0].clientX); }, { passive: false });
  overlay.addEventListener('touchend', hide);
}

export function renderElevationChart(profile, width = 800, height = 200) {
  if (!profile || profile.length < 2) return '';

  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const maxDist = profile[profile.length - 1].dist;
  const minEle = Math.min(...profile.map(p => p.ele));
  const maxEle = Math.max(...profile.map(p => p.ele));
  const eleRange = maxEle - minEle || 1;

  const toX = d => pad.left + (d / maxDist) * W;
  const toY = e => pad.top + H - ((e - minEle) / eleRange) * H;

  const pts = profile.map(p => `${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
  const areaPath = `M${pad.left},${pad.top + H} ` +
    profile.map(p => `L${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ') +
    ` L${pad.left + W},${pad.top + H} Z`;

  // Y axis labels
  const steps = 4;
  const yLabels = Array.from({ length: steps + 1 }, (_, i) => {
    const ele = minEle + (eleRange * i / steps);
    const y = toY(ele);
    return `<text x="${pad.left - 4}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="var(--text-secondary)" font-size="10">${Math.round(ele)}m</text>`;
  }).join('');

  // X axis labels (every ~5km)
  const kmStep = Math.ceil(maxDist / 1000 / 5) * 5;
  const xLabels = [];
  for (let km = 0; km <= maxDist / 1000; km += kmStep) {
    const x = toX(km * 1000);
    xLabels.push(`<text x="${x.toFixed(1)}" y="${pad.top + H + 16}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${km}km</text>`);
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      <defs>
        <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--ios-blue)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--ios-blue)" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#elev-grad)"/>
      <polyline points="${pts}" fill="none" stroke="var(--ios-blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${yLabels}
      ${xLabels.join('')}
    </svg>
  `;
}
