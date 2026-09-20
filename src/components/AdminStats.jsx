"use client";
import './AdminStats.css';

function AdminStats({ stats }) {
    return (
        <div className="admin-stats-row">
            {stats.map((stat, index) => (
                <div key={index} className="admin-stat-card">
                    <span className="admin-stat-titulo">{stat.titulo}</span>
                    <span
                        className="admin-stat-valor"
                        style={{ color: stat.color || '#111' }}
                    >
                        {stat.valor}
                    </span>
                </div>
            ))}
        </div>
    );
}

export default AdminStats;