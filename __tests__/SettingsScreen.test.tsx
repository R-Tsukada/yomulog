import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import SettingsScreen from '../components/SettingsScreen';

const mockSignOut = supabase.auth.signOut as jest.Mock;

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('renders user email', () => {
    render(<SettingsScreen email="test@example.com" />);

    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders logout button', () => {
    render(<SettingsScreen email="test@example.com" />);

    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });

  it('calls signOut when logout is pressed', async () => {
    render(<SettingsScreen email="test@example.com" />);

    fireEvent.press(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('shows error message on failed logout', async () => {
    mockSignOut.mockResolvedValueOnce({
      error: { message: 'Network error' },
    });

    render(<SettingsScreen email="test@example.com" />);

    fireEvent.press(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeTruthy();
    });
  });
});
