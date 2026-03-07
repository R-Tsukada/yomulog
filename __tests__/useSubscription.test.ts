import { renderHook, waitFor, act } from '@testing-library/react-native';

// jest.mock はホイストされるため、factory 内で jest.fn() を直接定義する
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getCustomerInfo:                jest.fn(),
    addCustomerInfoUpdateListener:  jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

const mockGetCustomerInfo               = Purchases.getCustomerInfo as jest.Mock;
const mockAddCustomerInfoUpdateListener = Purchases.addCustomerInfoUpdateListener as jest.Mock;
const mockFrom                          = supabase.from as jest.Mock;
const mockUseAuth                       = useAuth as jest.Mock;

const mockSession = { user: { id: 'user-123' } };

const activeCustomerInfo = {
  entitlements: { active: { premium: { identifier: 'premium' } } },
};
const inactiveCustomerInfo = {
  entitlements: { active: {} },
};

/** RevenueCat 成功時：upsert を返す */
function setupUpsertMock() {
  const mockUpsert = jest.fn().mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ upsert: mockUpsert });
  return mockUpsert;
}

/** Supabase フォールバック用チェーンモック */
function setupFallbackMock(data: object | null) {
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  const mockEq2         = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockEq1         = jest.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect      = jest.fn().mockReturnValue({ eq: mockEq1 });
  mockFrom.mockReturnValue({ select: mockSelect });
  return { mockMaybeSingle };
}

describe('useSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: mockSession });
    mockAddCustomerInfoUpdateListener.mockReturnValue({ remove: jest.fn() });
  });

  it('starts with loading status', () => {
    // 非同期を完了させない（Pending のまま）
    mockGetCustomerInfo.mockReturnValue(new Promise(() => {}));
    setupUpsertMock();

    const { result } = renderHook(() => useSubscription());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isSubscribed=true when RevenueCat entitlement is active', async () => {
    mockGetCustomerInfo.mockResolvedValue(activeCustomerInfo);
    setupUpsertMock();

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSubscribed).toBe(true);
  });

  it('returns isSubscribed=false when RevenueCat entitlement is inactive', async () => {
    mockGetCustomerInfo.mockResolvedValue(inactiveCustomerInfo);
    setupUpsertMock();

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSubscribed).toBe(false);
  });

  it('syncs subscription status to Supabase user_profiles', async () => {
    mockGetCustomerInfo.mockResolvedValue(activeCustomerInfo);
    const mockUpsert = setupUpsertMock();

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', is_subscribed: true }),
      expect.objectContaining({ onConflict: 'user_id' })
    );
  });

  it('falls back to Supabase when RevenueCat getCustomerInfo fails', async () => {
    mockGetCustomerInfo.mockRejectedValue(new Error('network error'));
    setupFallbackMock({ is_subscribed: true });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSubscribed).toBe(true);
  });

  it('returns isSubscribed=false when both RevenueCat and Supabase fail', async () => {
    mockGetCustomerInfo.mockRejectedValue(new Error('network error'));
    setupFallbackMock(null);

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSubscribed).toBe(false);
  });

  it('registers a customer info update listener on mount', async () => {
    mockGetCustomerInfo.mockResolvedValue(activeCustomerInfo);
    setupUpsertMock();

    renderHook(() => useSubscription());

    await waitFor(() => {
      expect(mockAddCustomerInfoUpdateListener).toHaveBeenCalled();
    });
  });

  it('syncs to Supabase when listener receives a customer info update', async () => {
    let capturedListener: ((info: unknown) => void) | undefined;
    mockAddCustomerInfoUpdateListener.mockImplementation((cb) => {
      capturedListener = cb;
      return { remove: jest.fn() };
    });

    mockGetCustomerInfo.mockResolvedValue(activeCustomerInfo);
    const mockUpsert = setupUpsertMock();

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = mockUpsert.mock.calls.length;

    act(() => capturedListener!(inactiveCustomerInfo));

    await waitFor(() => {
      expect(mockUpsert.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(mockUpsert).toHaveBeenLastCalledWith(
        expect.objectContaining({ user_id: 'user-123', is_subscribed: false }),
        expect.objectContaining({ onConflict: 'user_id' })
      );
    });
  });

  it('does not fetch when session is null', () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useSubscription());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });
});
