#!/bin/bash
set -e
pnpm install --frozen-lockfile
# NOTA: se removio "pnpm --filter db push" de aqui.
# Ese comando compara lib/db/src/schema/*.ts contra la base de datos real
# y, al detectar tablas/columnas que existen en la BD pero no en el schema.ts
# (notas, workshops, orientacion_estados, orientacion_horas_disponibles,
# school_year, dado_de_alta, etc.), las trataba como "sobrantes" y aplicaba
# cambios destructivos sin pedir confirmacion (por correr sin TTY).
# Esto borraba informacion de clases/alumnos cada vez que se mergeaba codigo.
# Las migraciones reales las hace ensureTables() en artifacts/api-server/src/index.ts
# al arrancar el servidor, de forma segura (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
