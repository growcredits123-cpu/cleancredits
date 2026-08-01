import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../app/(auth)/login';
import { supabase } from '../lib/supabase';

// We mock the router so we can test navigation
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

describe('Authentication Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login screen correctly', async () => {
    const { getByText, getByPlaceholderText } = await render(<AuthScreen />);
    
    expect(getByText('Welcome to EcoSwap')).toBeTruthy();
    expect(getByPlaceholderText('Email address')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('handles sign in with valid credentials', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValueOnce({ data: { user: { id: '123' } }, error: null });

    const { getByText, getByPlaceholderText } = await render(<AuthScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email address'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows error on invalid login', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid credentials' } });

    const { getByText, getByPlaceholderText, findByText } = await render(<AuthScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email address'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(getByText('Sign In'));

    const errorMessage = await findByText('Invalid credentials');
    expect(errorMessage).toBeTruthy();
  });
});
