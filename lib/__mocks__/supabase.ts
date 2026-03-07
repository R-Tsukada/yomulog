// Manual mock for lib/supabase.ts
// Jest resolves this file when jest.mock('../lib/supabase') is called without a factory.
export const mockSignUp = jest.fn();
export const mockSignInWithPassword = jest.fn();
export const mockSignOut = jest.fn();
export const mockGetSession = jest.fn();
export const mockFrom = jest.fn();

export const supabase = {
  auth: {
    signUp: mockSignUp,
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
    getSession: mockGetSession,
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: mockFrom,
};
