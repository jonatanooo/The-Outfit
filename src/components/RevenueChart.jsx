"use client";

import { useState, useRef, useEffect } from 'react';

function formatoMoneda(valor) {
    return `$${Number(valor ?? 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatoMonedaCorta(valor) {
    if (valor >= 1000) {
        return `$${(valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1)}k`;
    }
    return `$${valor}`;
}

// Genera un path SVG suave (curva cúbica Catmull-Rom / Bezier)
function generarCurvaSuave(puntos) {
    if (puntos.length === 0) return '';
    if (puntos.length === 1) return `M ${puntos[0].x} ${puntos[0].y}`;

    let d = `M ${puntos[0].x.toFixed(2)} ${puntos[0].y.toFixed(2)}`;
    for (let i = 0; i < puntos.length - 1; i++) {
        const p0 = puntos[i];
        const p1 = puntos[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
        const cpy1 = p0.y;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
        const cpy2 = p1.y;
        d += ` C ${cpx1.toFixed(2)} ${cpy1.toFixed(2)}, ${cpx2.toFixed(2)} ${cpy2.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }
    return d;
}

export default function RevenueChart({ data }) {
    const containerRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(860);
    const [hoverIdx, setHoverIdx] = useState(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setChartWidth(Math.max(320, Math.floor(entry.contentRect.width)));
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    if (!data || data.length === 0) return null;

    const height = 280;
    const paddingLeft = 64;
    const paddingRight = 24;
    const paddingTop = 24;
    const paddingBottom = 42;

    const innerW = Math.max(100, chartWidth - paddingLeft - paddingRight);
    const innerH = height - paddingTop - paddingBottom;

    const valores = data.map((d) => Number(d.value || 0));
    const maxVal = Math.max(...valores, 0);
    const totalPeriodo = valores.reduce((acc, v) => acc + v, 0);
    const promedioDiario = data.length > 0 ? totalPeriodo / data.length : 0;
    const diaMaximo = data.reduce(
        (max, item) => (Number(item.value || 0) > Number(max.value || 0) ? item : max),
        data[0]
    );

    const pasos = 5;
    const techoBruto = maxVal === 0 ? 100 : maxVal;
    const magnitud = Math.pow(10, Math.floor(Math.log10(techoBruto / pasos)));
    const escalon = Math.max(1, Math.ceil((techoBruto / pasos) / magnitud) * magnitud);
    const techo = escalon * pasos;
    const ejeY = Array.from({ length: pasos + 1 }, (_, i) => escalon * i);

    const puntos = data.map((d, i) => {
        const x = paddingLeft + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
        const y = paddingTop + innerH - (Number(d.value || 0) / techo) * innerH;
        return { x, y, label: d.label, value: Number(d.value || 0) };
    });

    const lineaCurva = generarCurvaSuave(puntos);
    const base = paddingTop + innerH;
    const areaCurva = `${lineaCurva} L ${puntos[puntos.length - 1].x.toFixed(2)} ${base} L ${puntos[0].x.toFixed(2)} ${base} Z`;

    const maxEtiquetasX = chartWidth < 520 ? 5 : 8;
    const salto = Math.max(1, Math.ceil(data.length / maxEtiquetasX));

    const puntoActivo = hoverIdx != null ? puntos[hoverIdx] : null;

    return (
        <div className="revenue-chart-wrapper">
            {/* Resumen superior del gráfico */}
            <div className="revenue-chart-summary">
                <div className="revenue-summary-pill">
                    <span className="revenue-summary-label">Promedio diario</span>
                    <strong className="revenue-summary-value">{formatoMoneda(promedioDiario)}</strong>
                </div>
                <div className="revenue-summary-pill">
                    <span className="revenue-summary-label">Día más alto ({diaMaximo?.label})</span>
                    <strong className="revenue-summary-value">{formatoMoneda(diaMaximo?.value || 0)}</strong>
                </div>
            </div>

            <div className="revenue-chart-canvas" ref={containerRef}>
                <svg
                    viewBox={`0 0 ${chartWidth} ${height}`}
                    className="revenue-chart-svg"
                    preserveAspectRatio="xMidYMid meet"
                    onMouseLeave={() => setHoverIdx(null)}
                >
                    <defs>
                        <linearGradient id="revenueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#111827" stopOpacity="0.18" />
                            <stop offset="85%" stopColor="#111827" stopOpacity="0.02" />
                            <stop offset="100%" stopColor="#111827" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Líneas guía horizontales y etiquetas del eje Y con proporción 1:1 */}
                    {ejeY.map((valor) => {
                        const y = paddingTop + innerH - (valor / techo) * innerH;
                        return (
                            <g key={valor}>
                                <line
                                    x1={paddingLeft}
                                    x2={chartWidth - paddingRight}
                                    y1={y}
                                    y2={y}
                                    stroke={valor === 0 ? '#d1d5db' : '#f0f0f0'}
                                    strokeDasharray={valor === 0 ? undefined : '4 4'}
                                    strokeWidth="1"
                                />
                                <text
                                    x={paddingLeft - 12}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="revenue-axis-text"
                                >
                                    {formatoMonedaCorta(valor)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Área y curva suave */}
                    <path d={areaCurva} fill="url(#revenueAreaGrad)" />
                    <path
                        d={lineaCurva}
                        fill="none"
                        stroke="#111827"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Línea guía vertical al pasar el cursor */}
                    {puntoActivo && (
                        <line
                            x1={puntoActivo.x}
                            x2={puntoActivo.x}
                            y1={paddingTop}
                            y2={base}
                            stroke="#9ca3af"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                    )}

                    {/* Puntos de datos */}
                    {puntos.map((p, i) => {
                        const esActivo = hoverIdx === i;
                        const mostrarPunto = data.length <= 14 || esActivo || p.value > 0;
                        return (
                            <g key={i}>
                                {mostrarPunto && (
                                    <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={esActivo ? 5.5 : 3.5}
                                        fill={esActivo ? '#111827' : '#ffffff'}
                                        stroke="#111827"
                                        strokeWidth={esActivo ? '2.5' : '2'}
                                    />
                                )}
                                {/* Franja interactiva invisible para facilitar el hover por día */}
                                <rect
                                    x={p.x - innerW / Math.max(2, data.length) / 2}
                                    y={paddingTop}
                                    width={innerW / Math.max(1, data.length)}
                                    height={innerH}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoverIdx(i)}
                                />
                            </g>
                        );
                    })}

                    {/* Etiquetas del eje X */}
                    {puntos.map((p, i) => {
                        const mostrar = i % salto === 0 || i === puntos.length - 1;
                        if (!mostrar) return null;
                        return (
                            <text
                                key={`lbl-${i}`}
                                x={p.x}
                                y={height - 12}
                                textAnchor="middle"
                                className={`revenue-axis-text ${hoverIdx === i ? 'activo' : ''}`}
                            >
                                {p.label}
                            </text>
                        );
                    })}
                </svg>

                {/* Tooltip flotante */}
                {puntoActivo && (
                    <div
                        className="revenue-chart-tooltip"
                        style={{
                            left: `${Math.min(Math.max(puntoActivo.x, 75), chartWidth - 75)}px`,
                            top: `${Math.max(puntoActivo.y - 12, 8)}px`,
                        }}
                    >
                        <span className="revenue-tooltip-date">{puntoActivo.label}</span>
                        <strong className="revenue-tooltip-amount">{formatoMoneda(puntoActivo.value)}</strong>
                    </div>
                )}
            </div>
        </div>
    );
}
