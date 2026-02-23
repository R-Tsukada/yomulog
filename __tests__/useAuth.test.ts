import { renderHook, waitFor, act } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('returns null session initially while loading', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    // Initial state (before getSession resolves)
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(true);

    // Let the async getSession resolve
    await act(async () => {});
  }); 

  it('returns session after loading', async () => {
    const mockSession = { access_token: 'token', user: { id: '123' } };
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(mockSession);
  });

  it('subscribes to auth state changes', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderHook(() => useAuth());

    expect(mockOnAuthStateChange).toHaveBeenCalled();

    await act(async () => {});
  });
});
