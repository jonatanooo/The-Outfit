"use client";

// Grafico de linea con area, dibujado a mano en SVG (sin libreria externa)
// data: [{ label: string, value: number }]
export default function RevenueChart({ data }) {
    if (!data || data.length === 0) return null;

    const width = 900;
    const height = 260;
    const paddingLeft = 60;
    const paddingRight = 16;
    const paddingTop = 16;
    const paddingBottom = 32;

    const innerW = width - paddingLeft - paddingRight;
    const innerH = height - paddingTop - paddingBottom;

    const maxVal = Math.max(...data.map((d) => d.value), 0);
    const pasos = 6;
    const techoBruto = maxVal === 0 ? pasos : maxVal;
    const escalon = Math.ceil(techoBruto / pasos / 10) * 10 || 1;
    const techo = escalon * pasos;
    const ejeY = Array.from({ length: pasos + 1 }, (_, i) => escalon * i);

    const puntos = data.map((d, i) => {
        const x = paddingLeft + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
        const y = paddingTop + innerH - (d.value / techo) * innerH;
        return { x, y, ...d };
    });

    const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const base = paddingTop + innerH;
    const area = `${linea} L ${puntos[puntos.length - 1].x.toFixed(2)} ${base} L ${puntos[0].x.toFixed(2)} ${base} Z`;

    // como maximo ~7 etiquetas en el eje X para que no se amontonen
    const salto = Math.max(1, Math.ceil(data.length / 7));

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="revenue-chart" preserveAspectRatio="none">
            <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b9bd5" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#5b9bd5" stopOpacity="0" />
                </linearGradient>
            </defs>

            {ejeY.map((valor) => {
                const y = paddingTop + innerH - (valor / techo) * innerH;
                return (
                    <g key={valor}>
                        <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#e6e6e6" strokeDasharray="4 4" />
                        <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#888">
                            ${valor}
                        </text>
                    </g>
                );
            })}

            <path d={area} fill="url(#revenueFill)" />
            <path d={linea} fill="none" stroke="#3d7fc4" strokeWidth="2" />

            {puntos.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#3d7fc4" />
            ))}

            {puntos.map(
                (p, i) =>
                    i % salto === 0 && (
                        <text key={`lbl-${i}`} x={p.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#888">
                            {p.label}
                        </text>
                    )
            )}
        </svg>
    );
}
