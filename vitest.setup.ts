import { vi } from 'vitest';

// Next "server-only" throws when imported outside of Next runtime.
// In unit tests, we mock it as a no-op.
vi.mock('server-only', () => ({}));
