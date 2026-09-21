"use client";
import './AdminHeader.css';

function AdminHeader({ titulo, subtitulo }) {
    return (
        <header className="admin-header">
            <div className="admin-header-texto">
                <h1>{titulo}</h1>
                {subtitulo && <p>{subtitulo}</p>}
            </div>
        </header>
    );
}

export default AdminHeader;