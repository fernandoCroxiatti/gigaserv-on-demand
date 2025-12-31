/**
 * Services Layer
 * 
 * This layer isolates external integrations (Supabase, APIs, etc.)
 * from the rest of the application.
 * 
 * Benefits:
 * - Easy to mock for testing
 * - Easy to replace backend implementation
 * - Clear separation between domain logic and infrastructure
 * - Facilitates native mobile migration
 */

// Chamado services
export * from './chamado';

// Chat services
export * from './chat';

// Provider services
export * from './provider';
