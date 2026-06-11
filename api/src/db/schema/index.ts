/**
 * Single import surface for the Drizzle schema.
 *
 * Import everything here so `drizzle(client, { schema })` gets every table and
 * enum for query typing and relational inference.
 */

// Enums + shared types
export * from './enums';
export * from './types';

// Identidad y Acceso
export * from './identity';

// Catálogo del Juego (versionado)
export * from './catalog';

// Dominio de Partida
export * from './domain';
