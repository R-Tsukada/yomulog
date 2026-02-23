import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import SignUpScreen from '../components/SignUpScreen';

const mockSignUp = supabase.auth.signUp as jest.Mock;

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Test 1: Rendering ---
  it('renders email, password, confirm password inputs and sign up button', () => {
    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeTruthy();
  });

  // --- Test 2: Login link ---
  it('renders a link to login screen', () => {
    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    expect(screen.getByText(/log in/i)).toBeTruthy();
  });

  // --- Test 3: Password mismatch ---
  it('shows error when passwords do not match', async () => {
    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'different');
    fireEvent.press(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
    });
  });

  // --- Test 4: Password minimum length ---
  it('shows error when password is too short', async () => {
    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), '12345');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), '12345');
    fireEvent.press(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeTruthy();
    });
  });

  // --- Test 5: Successful sign up ---
  it('calls signUp with correct credentials', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: '123' } },
      error: null,
    });

    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  // --- Test 6: Confirmation message ---
  it('shows confirmation email message after successful sign up', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: '123' } },
      error: null,
    });

    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeTruthy();
    });
  });

  // --- Test 7: Failed sign up ---
  it('displays error message on failed sign up', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    render(<SignUpScreen onNavigateToLogin={() => {}} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/user already registered/i)).toBeTruthy();
    });
  });
});
