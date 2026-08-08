#!/usr/bin/env node
// Herramienta SOLO DE DESARROLLO para asignar app_metadata.role = "admin" a un usuario
// concreto de Supabase Auth usando la API administrativa (service_role).
//
// - Se ejecuta a mano:  node scripts/grant-admin.mjs <email|uuid>
// - No forma parte del bundle del cliente: solo Node, fuera de src/.
// - Lee SUPABASE_SECRET_KEY y NEXT_PUBLIC_SUPABASE_URL desde .env.local.
// - Protectora: requiere NODE_ENV != production y GRANT_ADMIN_ALLOWED=1 en cada ejecución.

import { createClient } from "@supabase/supabase-js";

const TARGET = process.argv[2];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;

function fail(message) {
  console.error(`[grant-admin] ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  fail("Bloqueado: NODE_ENV=production. Este script es SOLO para desarrollo.");
}

if (process.env.GRANT_ADMIN_ALLOWED !== "1") {
  fail(
    "Bloqueado: falta la confirmación explícita. Ejecuta con GRANT_ADMIN_ALLOWED=1 " +
      "(por ejemplo: $env:GRANT_ADMIN_ALLOWED=\"1\"; node scripts/grant-admin.mjs <email|uuid>).",
  );
}

if (!TARGET) {
  fail('Uso: node scripts/grant-admin.mjs <email|uuid>');
}

try {
  process.loadEnvFile(".env.local");
} catch (error) {
  fail(`No se pudo cargar .env.local: ${error.message}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  fail("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
}

if (!SECRET_KEY) {
  fail(
    "Falta SUPABASE_SECRET_KEY en .env.local.\n" +
      "Obtenla en Supabase Dashboard -> Settings -> API -> API keys -> secret " +
      "(clave secreta, jamás la expongas al navegador).",
  );
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUser(target) {
  if (UUID_RE.test(target)) {
    const { data, error } = await supabase.auth.admin.getUserById(target);
    if (error) {
      fail(`No se encontró ningún usuario con UUID "${target}": ${error.message}`);
    }
    return { id: data.user.id, email: data.user.email ?? "(sin email)" };
  }

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) {
      fail(`Error listando usuarios: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target.toLowerCase(),
    );
    if (match) {
      return { id: match.id, email: match.email };
    }

    if (data.users.length < PAGE_SIZE) {
      fail(`No se encontró ningún usuario con email "${target}".`);
    }
  }
}

const user = await resolveUser(TARGET);

const { data: before } = await supabase.auth.admin.getUserById(user.id);
const currentRole = before?.user?.app_metadata?.role;

console.log(`Usuario : ${user.email}`);
console.log(`UUID    : ${user.id}`);
console.log(`Rol actual (app_metadata.role): ${currentRole ?? "(sin rol)"}`);

if (currentRole === "admin") {
  console.log("El usuario ya es admin. No se hizo ningún cambio.");
  process.exit(0);
}

console.log(`Asignando app_metadata.role = "admin" ...`);

const { data: updated, error } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { role: "admin" },
});

if (error) {
  fail(`Error actualizando el rol: ${error.message}`);
}

console.log("OK. Rol asignado correctamente.");
console.log(`Nuevo app_metadata.role: ${updated.user.app_metadata.role}`);
console.log(
  "Importante: cierra sesión y vuelve a entrar (o espera el refresh del token) " +
    "para que getClaims() vea el nuevo rol y /admin/videos deje de devolver 404.",
);
