import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock must use jest.fn() INSIDE the factory
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import LoginScreen from '../components/LoginScreen';

// Get a typed reference to the mock
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Test 1〜4 are unchanged ---

 it('renders email and password inputs and a login button', () => {
    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log in/i })).toBeTruthy();
  });

  it('renders a link to sign up screen', () => {
    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    expect(screen.getByText(/sign up/i)).toBeTruthy();
  });

  it('disables login button when fields are empty', () => {
    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    const button = screen.getByRole('button', { name: /log in/i });
    expect(button).toBeDisabled();
  });

  it('shows error for invalid email format', async () => {
    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'invalid-email');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeTruthy();
    });
  });

  // --- Test 5〜7: fixed mock pattern ---

  it('calls signInWithPassword with correct credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: { access_token: 'token' } },
      error: null,
    });

    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('displays error message on failed login', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeTruthy();
    });
  });

  it('shows loading state while logging in', async () => {
    jest.useFakeTimers();

    mockSignInWithPassword.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        data: { session: { access_token: 'token' } },
        error: null,
      }), 1000))
    );

    render(<LoginScreen onNavigateToSignUp={() => {}} />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/logging in/i)).toBeTruthy();
    });

    await act(async () => {
      jest.runAllTimers();
    });

    jest.useRealTimers();
  });
});
