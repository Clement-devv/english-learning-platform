import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import TeacherModeLogin from './TeacherModeLogin';
import client from './client';
vi.mock('./client', () => ({ default: { post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('./useStudioLanguage', () => ({ useStudioLanguage: () => {} }));
vi.mock('./StudioLanguageSwitch', () => ({ default: () => null }));
vi.mock('./studioLanguage', () => ({ studioText: text => text }));
vi.mock('../../components/TermsModal', () => ({ AccountTerms: () => null }));
beforeEach(() => vi.clearAllMocks());
it('checks confirmation before saving and toggles each field independently', async () => {
  client.post.mockResolvedValue({ data: {} });
  render(<MemoryRouter initialEntries={['/teacher-mode/setup/invite']}><Routes>
    <Route path="/teacher-mode/setup/:token" element={<TeacherModeLogin mode="setup" />} />
    <Route path="/teacher-mode/login" element={<TeacherModeLogin />} />
  </Routes></MemoryRouter>);
  const password = screen.getByLabelText('Password'), confirm = screen.getByLabelText('Confirm password');
  fireEvent.change(password, { target: { value: 'Example@1234' } });
  fireEvent.change(confirm, { target: { value: 'Different@1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show password', exact: true }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirm).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password', exact: true }));
  expect(password).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Show confirm password' }));
  expect(confirm).toHaveAttribute('type', 'text');
  expect(client.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(password.closest('form'));
  expect(screen.getByRole('status')).toHaveTextContent('Passwords do not match');
  expect(client.post).not.toHaveBeenCalled();
  fireEvent.change(confirm, { target: { value: 'Example@1234' } });
  fireEvent.submit(password.closest('form'));
  await screen.findByRole('button', { name: 'Open my workspace' });
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(password).toHaveValue('');
  expect(confirm).toHaveValue('');
  expect(confirm).toHaveAttribute('type', 'password');
});
