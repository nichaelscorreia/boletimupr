// Componente Gráfico Leve em Canvas/SVG para Dashboards Industriais Corporativos

const Charts = {
  renderLineChart(canvasId, { labels = [], datasets = [], title = '', yUnit = 't' }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 500;
    const height = rect.height || 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (labels.length === 0 || datasets.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados disponíveis', width / 2, height / 2);
      return;
    }

    const padLeft = 45;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Find max value
    let maxVal = 0;
    datasets.forEach(ds => {
      ds.data.forEach(v => {
        if (v > maxVal) maxVal = v;
      });
    });
    if (maxVal === 0) maxVal = 100;
    maxVal = Math.ceil(maxVal * 1.15);

    // Draw horizontal grid lines
    const gridLines = 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
      const yVal = (maxVal / gridLines) * i;
      const yPos = padTop + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(padLeft + chartW, yPos);
      ctx.stroke();

      const labelTxt = yVal >= 1000 ? (yVal / 1000).toFixed(1) + 'k' : Math.round(yVal);
      ctx.fillText(labelTxt, padLeft - 6, yPos);
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const stepX = chartW / Math.max(labels.length - 1, 1);

    const labelSkip = labels.length > 15 ? 2 : 1;
    labels.forEach((lbl, idx) => {
      if (idx % labelSkip === 0 || idx === labels.length - 1) {
        const xPos = padLeft + idx * stepX;
        ctx.fillText(lbl, xPos, padTop + chartH + 8);
      }
    });

    // Draw Datasets
    datasets.forEach(ds => {
      const color = ds.color || '#10b981';
      const pts = ds.data.map((val, idx) => ({
        x: padLeft + idx * stepX,
        y: padTop + chartH - (val / maxVal) * chartH
      }));

      if (pts.length === 0) return;

      // Area fill
      if (ds.fill) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, padTop + chartH);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, padTop + chartH);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        grad.addColorStop(0, ds.fillColor || 'rgba(16, 185, 129, 0.25)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Stroke line
      ctx.beginPath();
      ctx.lineWidth = ds.lineWidth || 2.5;
      ctx.strokeStyle = color;
      if (ds.dashed) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);

      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Dots on points
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        ctx.stroke();
      });
    });
  },

  renderDonut(svgId, slices = []) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const total = slices.reduce((acc, s) => acc + s.value, 0);
    if (total === 0) return;

    let accumulatedAngle = 0;
    const center = 50;
    const radius = 38;
    const strokeWidth = 14;

    const paths = slices.map(s => {
      const percentage = s.value / total;
      const angle = percentage * 360;
      const dashArray = 2 * Math.PI * radius;
      const strokeDashoffset = dashArray * (1 - percentage);
      const rotation = accumulatedAngle;
      accumulatedAngle += angle;

      return `
        <circle cx="${center}" cy="${center}" r="${radius}" 
                fill="none" 
                stroke="${s.color}" 
                stroke-width="${strokeWidth}" 
                stroke-dasharray="${dashArray}" 
                stroke-dashoffset="${strokeDashoffset}"
                transform="rotate(${rotation - 90} ${center} ${center})"
                style="transition: stroke-dashoffset 0.8s ease;" />
      `;
    }).join('');

    svg.innerHTML = paths;
  }
};
