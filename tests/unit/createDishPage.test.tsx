import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateDishPage from '../../src/pages/CreateDishPage';
import { AppThemeProvider } from '../../src/hooks/useGuestTheme';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock('../../src/services/api', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/components/Admin/DishForm', () => ({ default: () => null }));
vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({ user: { restaurant: { menu_categories: ['Drinks'] } } }),
}));

describe('CreateDishPage preview upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { ingredients: [], data: [] } });
    mocks.post.mockResolvedValue({ data: { id: 901 } });
  });

  const fillForm = () => {
    const view = render(<AppThemeProvider><CreateDishPage /></AppThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Select Packaged Drink' }));
    fireEvent.change(view.container.querySelector('select[name="category"]')!, { target: { value: 'Drinks' } });
    fireEvent.change(screen.getByPlaceholderText('12.99'), { target: { value: '3.50' } });
    fireEvent.change(screen.getByPlaceholderText('Pepsi / Coca-Cola'), { target: { value: 'QA_RUN_20261006_PreviewRetry' } });
    fireEvent.change(screen.getByPlaceholderText('0', { exact: true }), { target: { value: '10' } });
    const preview = new File(['QA_RUN_preview_bytes'], 'QA_RUN_preview.png', { type: 'image/png' });
    fireEvent.change(view.container.querySelector('input[name="preview_file"]')!, { target: { files: [preview] } });
    return preview;
  };

  const submitForm = () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Create Menu Item', exact: true }).closest('form')!);
  };

  it('submits the preview in one create request and navigates after success', async () => {
    const preview = fillForm();
    submitForm();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/dashboard'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, body] = mocks.post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/dishes');
    expect(body.get('preview_file')).toBe(preview);
    expect(body.get('name')).toBe('QA_RUN_20261006_PreviewRetry');
  });

  it('retains the form after preview failure and retries the complete create request', async () => {
    mocks.post.mockRejectedValueOnce({ response: { status: 503, data: { message: 'QA_RUN preview unavailable' } } });
    const preview = fillForm();
    submitForm();
    await screen.findAllByText('QA_RUN preview unavailable');
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Pepsi / Coca-Cola')).toHaveValue('QA_RUN_20261006_PreviewRetry');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Menu Item', exact: true })).toBeEnabled());
    submitForm();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/dashboard'));
    expect(mocks.post).toHaveBeenCalledTimes(2);
    for (const [url, body] of mocks.post.mock.calls as Array<[string, FormData]>) {
      expect(url).toBe('/dishes');
      expect(body.get('preview_file')).toBe(preview);
    }
  });

  it('stays on the form after server validation fails without creating an asset separately', async () => {
    mocks.post.mockRejectedValueOnce({ response: { status: 422, data: { message: 'QA_RUN invalid preview' } } });
    fillForm();
    submitForm();
    await screen.findAllByText('QA_RUN invalid preview');
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('includes the selected serving temperature in packaged-drink creation', async () => {
    fillForm();
    fireEvent.change(document.querySelector('select[name="serving_temperature"]')!, { target: { value: 'cold' } });
    submitForm();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin/dashboard'));
    const body = mocks.post.mock.calls[0][1] as FormData;
    expect(body.get('serving_temperature')).toBe('cold');
  });
});
