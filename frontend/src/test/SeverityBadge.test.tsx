import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SeverityBadge } from '../components/SeverityBadge';

describe('SeverityBadge component', () => {
  it('renders critical severity badge correctly', () => {
    render(<SeverityBadge severity="critical" />);
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
  });

  it('renders high severity badge correctly', () => {
    render(<SeverityBadge severity="high" />);
    const badge = screen.getByText('High');
    expect(badge).toBeInTheDocument();
  });

  it('renders clean severity badge correctly', () => {
    render(<SeverityBadge severity="clean" />);
    const badge = screen.getByText('Clean');
    expect(badge).toBeInTheDocument();
  });

  it('defaults to low badge when unknown severity provided', () => {
    render(<SeverityBadge severity="unknown" />);
    const badge = screen.getByText('Low');
    expect(badge).toBeInTheDocument();
  });
});
