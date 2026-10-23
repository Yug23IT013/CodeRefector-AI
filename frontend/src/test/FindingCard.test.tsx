import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FindingCard } from '../components/FindingCard';
import { Finding } from '../types';

const mockFinding: Finding = {
  id: 1,
  file_path: 'backend/app/auth.py',
  line_number: 25,
  rule_id: 'SEC001',
  severity: 'critical',
  category: 'security',
  message: 'Dangerous dynamic eval execution detected.',
  ai_suggestion: 'ast.literal_eval(payload)',
};

describe('FindingCard component', () => {
  it('renders finding details and metadata accurately', () => {
    render(<FindingCard finding={mockFinding} />);

    expect(screen.getByText('SEC001')).toBeInTheDocument();
    expect(screen.getByText('security')).toBeInTheDocument();
    expect(screen.getByText('backend/app/auth.py')).toBeInTheDocument();
    expect(screen.getByText(':L25')).toBeInTheDocument();
    expect(screen.getByText('Dangerous dynamic eval execution detected.')).toBeInTheDocument();
    expect(screen.getByText('ast.literal_eval(payload)')).toBeInTheDocument();
  });

  it('toggles visibility of the AI patch suggestion', () => {
    render(<FindingCard finding={mockFinding} />);

    // Initially expanded
    expect(screen.getByText('ast.literal_eval(payload)')).toBeInTheDocument();

    // Click 'Hide Fix' button
    const toggleButton = screen.getByRole('button', { name: /Hide Fix/i });
    fireEvent.click(toggleButton);

    // Patch should be hidden
    expect(screen.queryByText('ast.literal_eval(payload)')).not.toBeInTheDocument();

    // Button should now read 'Show AI Fix'
    const showButton = screen.getByRole('button', { name: /Show AI Fix/i });
    expect(showButton).toBeInTheDocument();
    fireEvent.click(showButton);

    // Patch visible again
    expect(screen.getByText('ast.literal_eval(payload)')).toBeInTheDocument();
  });
});
