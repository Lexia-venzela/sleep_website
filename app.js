const $ = id => document.getElementById(id);
const KEY = 'sleepLog';
const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const save = v => localStorage.setItem(KEY, JSON.stringify(v));

// ---- 탭 전환 ----
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('section').forEach(s => s.classList.remove('on'));
  $(b.dataset.t).classList.add('on');
  if (b.dataset.t === 'focus' || b.dataset.t === 'stress') drawCharts();
});

// ---- 1. 권장 수면 시간 (ornage+anaconda 돌리고 예측치 교체) ----
function recommend(age, cups, need) {
  let base = age <= 17 ? 9 : age <= 25 ? 8 : age <= 64 ? 7.5 : 7;
  base += Math.min(cups, 5) * 0.1;      // 카페인 보정 (최대 +0.5h)
  base += (need - 3) * 0.25;            // 집중 필요도 보정 (-0.5 ~ +0.5h)
  return Math.min(10, Math.max(6, base));
}
$('calc').onclick = () => {
  const h = recommend(+$('age').value, +$('cups')?.value || +$('caf').value, +$('need').value);
  const [wh, wm] = $('wake').value.split(':').map(Number);
  let bed = wh * 60 + wm - Math.round(h * 60) - 15; // 잠드는 데 15분 가정
  bed = (bed + 1440) % 1440;
  const f = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  $('recOut').innerHTML = `권장 수면: <b>${h.toFixed(1)}시간</b><br>권장 취침 시각: <b>${f(bed)}</b>`;
};

// ---- 기록 저장 ----
$('d').valueAsDate = new Date();
$('save').onclick = () => {
  const rec = { d: $('d').value, sh: +$('sh').value, pvt: +$('pvt').value,
                stroop: +$('stroop').value, st: +$('st').value };
  const data = load().filter(x => x.d !== rec.d).concat(rec).sort((a, b) => a.d.localeCompare(b.d));
  save(data); $('msg').textContent = '저장되었습니다 ✔';
};

// ---- 2·3. 7일 추이 + 상관관계->2, 3일은 뺄까? ----
const pearson = (x, y) => {
  const n = x.length; if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};
let charts = {};
function draw(canvasId, outId, label, key, color) {
  const w = load().slice(-7);
  charts[canvasId]?.destroy();
  charts[canvasId] = new Chart($(canvasId), {
    data: { labels: w.map(x => x.d.slice(5)),
      datasets: [
        { type: 'bar', label: '수면(시간)', data: w.map(x => x.sh), yAxisID: 'y' },
        { type: 'line', label, data: w.map(x => x[key]), borderColor: color, yAxisID: 'y2' }]},
    options: { scales: { y: { title: { display: true, text: '시간' } },
                         y2: { position: 'right', grid: { drawOnChartArea: false } } } }
  });
  const r = pearson(w.map(x => x.sh), w.map(x => x[key]));
  $(outId).textContent = r === null ? '데이터가 3일 이상 필요합니다.'
    : `수면시간과 ${label}의 상관계수: ${r.toFixed(2)} (7일 데이터, 참고용)`;
}
function drawCharts() {
  draw('c1', 'r1', 'PVT 반응시간(ms)', 'pvt', 'crimson');
  draw('c2', 'r2', '스트레스 지수', 'st', 'orange');
}

// ---- 4. 알림 ----
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