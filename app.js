const $ = id => document.getElementById(id);
const KEY = 'sleepLog';

const load = () => JSON.parse(localStorage.getItem(KEY) || '[]').map(r => ({
  d: r.d, sh: r.sh ?? null,
  focus: r.focus ?? null,
  stress: r.stress ?? r.st ?? null
}));
const save = v => localStorage.setItem(KEY, JSON.stringify(v));

// ---------- 밤하늘 별 생성 ----------
const FIXED_STARS = 90;   // 항상 박혀 있는 별 개수
const TWINKLE_STARS = 70; // 반짝이는 별 개수
const SHOOTING_STARS = 8; // 별똥별 개수 (늘리면 더 자주 내려옵니다)

(function makeSky() {
  const sky = $('sky');
  const rnd = (a, b) => a + Math.random() * (b - a);

  // 고정된 별 (반짝이지 않고 항상 보임)
  for (let i = 0; i < FIXED_STARS; i++) {
    const s = document.createElement('div');
    const size = rnd(1, 3);
    s.className = 'star fixed';
    s.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;width:${size}px;height:${size}px;` +
      (size > 2.3 ? 'box-shadow:0 0 6px 1px rgba(255,255,255,.7);' : '');
    sky.appendChild(s);
  }

  // 반짝이는 별
  for (let i = 0; i < TWINKLE_STARS; i++) {
    const s = document.createElement('div');
    const size = rnd(0.8, 3);
    s.className = 'star';
    s.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;width:${size}px;height:${size}px;` +
      `--d:${rnd(2, 6)}s;animation-delay:${rnd(0, 4)}s`;
    sky.appendChild(s);
  }

  // 별똥별 (위치·속도·간격이 제각각)
  for (let i = 0; i < SHOOTING_STARS; i++) {
    const s = document.createElement('div');
    s.className = 'shoot';
    s.style.cssText = `left:${rnd(-5, 60)}%;top:${rnd(0, 45)}%;` +
      `--dur:${rnd(6, 14)}s;--delay:${rnd(0, 10)}s`;
    sky.appendChild(s);
  }
})();

// ---------- 단계 정의 ----------
const COLORS = { red:'#e04b4b', yellow:'#f5a623', green:'#4caf50', blue:'#4a90d9' };

function focusLevel(v) {
  if (v <= 3) return { name:'낮음', color:COLORS.red };
  if (v <= 6) return { name:'보통', color:COLORS.yellow };
  return { name:'높음', color:COLORS.green };
}
function stressLevel(v) {
  if (v <= 25) return { name:'Resting state (휴식 상태)', color:COLORS.blue };
  if (v <= 50) return { name:'Low stress (낮은 정도의 스트레스)', color:COLORS.green };
  if (v <= 75) return { name:'Medium stress (중간 정도의 스트레스)', color:COLORS.yellow };
  return { name:'High stress (높은 정도의 스트레스)', color:COLORS.red };
}
const badge = l => `<span class="badge" style="background:${l.color}">${l.name}</span>`;

// 7.5 -> "7시간 30분"
function fmtHM(h) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return mm === 0 ? `${hh}시간` : `${hh}시간 ${mm}분`;
}

// ---------- 탭 전환 ----------
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.remove('act'));
  b.classList.add('act');
  document.querySelectorAll('section').forEach(s => s.classList.remove('on'));
  $(b.dataset.t).classList.add('on');
  if (b.dataset.t === 'focus' || b.dataset.t === 'stress') drawCharts();
});

// ---------- 1. 권장 수면 시간 (임시 규칙: 나중에 모델 계수로 교체) ----------
function recommend(age, cups, need) {
  let base = age <= 17 ? 9 : age <= 25 ? 8 : age <= 64 ? 7.5 : 7;
  base += Math.min(cups, 5) * 0.1;
  base += (need - 3) * 0.25;
  return Math.min(10, Math.max(6, base));
}
$('calc').onclick = () => {
  const h = recommend(+$('age').value, +$('caf').value, +$('need').value);
  const [wh, wm] = $('wake').value.split(':').map(Number);
  let bed = wh * 60 + wm - Math.round(h * 60) - 15;
  bed = (bed + 1440) % 1440;
  const f = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  $('recOut').innerHTML = `권장 수면: <b>${fmtHM(h)}</b> (${h.toFixed(2)}시간)<br>권장 취침 시각: <b>${f(bed)}</b>`;
};

// ---------- 기록 입력 ----------
$('d').valueAsDate = new Date();
$('focusIn').innerHTML = '<option value="">선택 안 함</option>' +
  Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');

// 시간/분 -> 소수 시간 (7시간 30분 -> 7.5)
function readSleep() {
  const hRaw = $('shH').value, mRaw = $('shM').value;
  if (hRaw === '' && mRaw === '') return null;
  const h = Math.max(0, Math.min(24, Math.floor(+hRaw || 0)));
  const m = Math.max(0, Math.min(59, Math.floor(+mRaw || 0)));
  return Math.round((h + m / 60) * 100) / 100;
}
function updateConv() {
  const v = readSleep();
  $('shConv').textContent = v === null ? '' : `= ${v}시간`;
}
$('shH').oninput = updateConv;
$('shM').oninput = updateConv;

$('focusIn').onchange = () => {
  const v = $('focusIn').value;
  $('focusLabel').innerHTML = v ? badge(focusLevel(+v)) : '';
};
$('stIn').oninput = () => {
  const v = $('stIn').value;
  $('stLabel').innerHTML = v !== '' ? badge(stressLevel(+v)) : '';
};

$('save').onclick = () => {
  const num = id => $(id).value === '' ? null : +$(id).value;
  const sh = readSleep(), focus = num('focusIn');
  let stress = num('stIn');
  if (!$('d').value || sh === null) { $('msg').textContent = '날짜와 수면 시간을 입력해 주세요.'; return; }
  if (+$('shM').value > 59) { $('msg').textContent = '분은 0~59 사이로 입력해 주세요.'; return; }
  if (stress !== null) stress = Math.min(100, Math.max(0, stress));
  const rec = { d: $('d').value, sh, focus, stress };
  const data = load().filter(x => x.d !== rec.d).concat(rec).sort((a, b) => a.d.localeCompare(b.d));
  save(data);
  $('msg').textContent = `저장되었습니다 ✔ (수면 ${fmtHM(sh)} = ${sh}시간)`;
};

// ---------- 그래프 ----------
Chart.register({
  id: 'bands',
  beforeDraw(chart, args, opts) {
    if (!opts || !chart.scales.y2) return;
    const { ctx, chartArea: { left, right }, scales: { y2 } } = chart;
    opts.forEach(b => {
      const top = y2.getPixelForValue(b.to), bottom = y2.getPixelForValue(b.from);
      ctx.save(); ctx.fillStyle = b.color; ctx.fillRect(left, top, right - left, bottom - top); ctx.restore();
    });
  }
});

const pearson = (x, y) => {
  const n = x.length; if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? null : sxy / d;
};

const charts = {};
function draw(cfg) {
  const w = load().slice(-7);
  charts[cfg.canvas]?.destroy();
  const vals = w.map(x => x[cfg.key]);

  charts[cfg.canvas] = new Chart($(cfg.canvas), {
    data: {
      labels: w.map(x => x.d.slice(5)),
      datasets: [
        { type: 'bar', label: '수면(시간)', data: w.map(x => x.sh),
          backgroundColor: 'rgba(70,85,150,0.6)', yAxisID: 'y', order: 2 },
        { type: 'line', label: cfg.label, data: vals, spanGaps: true,
          borderColor: '#333', borderWidth: 2, yAxisID: 'y2', order: 1,
          pointRadius: 7, pointHoverRadius: 9,
          pointBackgroundColor: vals.map(v => v == null ? '#999' : cfg.level(v).color),
          pointBorderColor: '#fff', pointBorderWidth: 2 }
      ]
    },
    options: {
      plugins: {
        bands: cfg.bands,
        tooltip: { callbacks: { label: c =>
          c.datasetIndex === 1 && c.raw != null
            ? `${cfg.label}: ${c.raw} → ${cfg.level(c.raw).name}`
            : `수면: ${fmtHM(c.raw)}` } }
      },
      scales: {
        y: { min: 0, max: 12, title: { display: true, text: '수면 시간(시간)' } },
        y2: { position: 'right', min: cfg.min, max: cfg.max,
              title: { display: true, text: cfg.axis }, grid: { drawOnChartArea: false } }
      }
    }
  });

  const pairs = w.filter(x => x.sh != null && x[cfg.key] != null);
  const out = $(cfg.out);
  if (pairs.length < 3) {
    out.innerHTML = `${cfg.label} 기록이 <b>3일 이상</b> 있어야 수면과의 관계를 보여드릴 수 있어요.`;
    return;
  }
  const r = pearson(pairs.map(x => x.sh), pairs.map(x => x[cfg.key]));
  const avg = pairs.reduce((a, x) => a + x[cfg.key], 0) / pairs.length;
  const avgSleep = pairs.reduce((a, x) => a + x.sh, 0) / pairs.length;
  let msg = '수면 시간과 뚜렷한 관계가 보이지 않습니다.';
  if (r !== null && r >= 0.5) msg = cfg.posMsg;
  else if (r !== null && r <= -0.5) msg = cfg.negMsg;
  out.innerHTML = `최근 평균 수면: <b>${fmtHM(avgSleep)}</b><br>
    최근 평균 ${cfg.label}: <b>${avg.toFixed(1)}</b> ${badge(cfg.level(avg))}<br>
    📌 ${msg}<br>
    <small>상관계수 ${r === null ? '-' : r.toFixed(2)} (최근 ${pairs.length}일, 경향일 뿐 원인을 의미하지 않아요)</small>`;
}

function drawCharts() {
  draw({
    canvas: 'c1', out: 'r1', key: 'focus', label: '집중도', axis: '집중도 (1~10점)',
    min: 0, max: 10, level: focusLevel,
    bands: [
      { from: 0, to: 3.5, color: 'rgba(224,75,75,0.15)' },
      { from: 3.5, to: 6.5, color: 'rgba(245,166,35,0.17)' },
      { from: 6.5, to: 10, color: 'rgba(76,175,80,0.17)' }
    ],
    posMsg: '잠을 많이 잔 날 집중도가 높은 경향이 있어요.',
    negMsg: '잠을 많이 잔 날 오히려 집중도가 낮은 경향이에요. 수면의 질이나 다른 요인도 살펴보세요.'
  });
  draw({
    canvas: 'c2', out: 'r2', key: 'stress', label: '스트레스 점수', axis: '스트레스 (0~100점)',
    min: 0, max: 100, level: stressLevel,
    bands: [
      { from: 0, to: 25, color: 'rgba(74,144,217,0.18)' },
      { from: 25, to: 50, color: 'rgba(76,175,80,0.17)' },
      { from: 50, to: 75, color: 'rgba(245,166,35,0.18)' },
      { from: 75, to: 100, color: 'rgba(224,75,75,0.16)' }
    ],
    posMsg: '잠을 많이 잔 날 스트레스 점수도 높은 경향이에요. 다른 요인을 함께 살펴보세요.',
    negMsg: '잠을 많이 잔 날 스트레스가 낮아지는 경향이 있어요.'
  });
}

// ---------- 알림 ----------
let timer;
$('aset').onclick = async () => {
  if (await Notification.requestPermission() !== 'granted') return alert('알림 권한이 필요합니다.');
  localStorage.setItem('alarm', $('atime').value);
  clearInterval(timer);
  timer = setInterval(() => {
    const now = new Date().toTimeString().slice(0, 5);
    if (now === localStorage.getItem('alarm') && localStorage.getItem('last') !== now + new Date().toDateString()) {
      new Notification('🌙 잘 시간이에요', { body: '카페인·화면 사용을 줄이고 잠자리에 들어보세요.' });
      localStorage.setItem('last', now + new Date().toDateString());
    }
  }, 20000);
  alert('알림이 설정되었습니다. (이 탭을 열어 두세요)');
};
$('aics').onclick = () => {
  const [h, m] = $('atime').value.split(':');
  const t = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${t}T${h}${m}00\nRRULE:FREQ=DAILY\nSUMMARY:취침 준비\nBEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:잠잘 시간입니다\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'sleep-reminder.ics'; a.click();
};