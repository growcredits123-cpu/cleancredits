import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WalletScreen from '../app/(tabs)/wallet';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// Mock useAuth to simulate logged in user
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
}));

describe('Wallet Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      session: { user: { id: 'test-user-123' } },
    });
  });

  it('renders wallet balance and elements', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fnName) => {
      if (fnName === 'get_user_balance') {
        return Promise.resolve({ data: 1500 });
      }
      return Promise.resolve({ data: null });
    });
    
    // Mock get entries
    const selectMock = supabase.from('ledger_entries').select;
    (selectMock as jest.Mock).mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          { id: '1', amount: 50, type: 'credit', description: 'Test credit' },
        ],
        error: null,
      }),
    });

    const { getByText, findByText } = await render(<WalletScreen />);
    
    expect(getByText('Wallet')).toBeTruthy();
    const balanceText = await findByText('1500');
    expect(balanceText).toBeTruthy();
    
    // Check if the ledger entry is displayed
    const ledgerDesc = await findByText('Test credit');
    expect(ledgerDesc).toBeTruthy();
  });

  it('handles sending tokens', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fnName) => {
      if (fnName === 'get_user_balance') {
        return Promise.resolve({ data: 1500 });
      }
      if (fnName === 'p2p_transfer') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null });
    });
    
    const { getByText, getByPlaceholderText, findByText } = await render(<WalletScreen />);
    
    // Open send modal
    fireEvent.press(getByText('Send'));
    
    // Fill out form
    fireEvent.changeText(getByPlaceholderText('Recipient Email'), 'friend@example.com');
    fireEvent.changeText(getByPlaceholderText('Amount'), '100');
    
    // Confirm send
    fireEvent.press(getByText('Confirm Send'));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('p2p_transfer', {
        p_recipient_email: 'friend@example.com',
        p_amount: 100,
      });
    });
  });
});
