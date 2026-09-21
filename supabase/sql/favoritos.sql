-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- La tabla "Favoritos" (ID_Favorito, ID_Producto, ID_User, Fecha_Agregado) ya existe.
-- Sigue el mismo patrón que "Fotos_Productos" y "Categorias_Producto": "ID_User"
-- apunta a public."User".ID_User, NO directo a auth.users (para eso está la columna
-- "auth_id" dentro de "User", ver perfil_usuario.sql). Este script solo activa RLS
-- y agrega la política para que cada usuario logueado gestione sus propios favoritos.

alter table public."Favoritos" enable row level security;

drop policy if exists "usuario_gestiona_sus_favoritos" on public."Favoritos";
create policy "usuario_gestiona_sus_favoritos"
on public."Favoritos"
for all
to authenticated
using (
  "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
)
with check (
  "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
);
