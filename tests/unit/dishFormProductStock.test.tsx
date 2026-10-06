import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DishForm from '../../src/components/Admin/DishForm';
import { AppThemeProvider } from '../../src/hooks/useGuestTheme';

vi.mock('../../src/contexts/useAuth', () => ({ useAuth: () => ({ user: { restaurant: { menu_categories: ['Drinks'] } } }) }));

describe('packaged product editing', () => {
  const renderForm = (quantity: string, ingredientId: number | null = null) => {
    const submit = vi.fn();
    const view = render(<MemoryRouter><AppThemeProvider><DishForm
      itemType="packaged_drink"
      requireModelUpload={false}
      onSubmit={submit}
      initialValues={{ name: 'QA_RUN_20261006_Drink', price: '3.50', category: 'Drinks', packaged_stock_quantity: quantity, direct_stock_ingredient_id: ingredientId, serving_temperature: 'cold' }}
    /></AppThemeProvider></MemoryRouter>);
    return { ...view, submit };
  };

  it.each(['10', '0'])('allows temperature edits with own stock quantity %s and no ingredient link', async (quantity) => {
    const view = renderForm(quantity);
    expect(screen.getByRole('button', { name: 'Save Dish', exact: true })).toBeEnabled();
    fireEvent.change(view.container.querySelector('select[name="serving_temperature"]')!, { target: { value: 'room' } });
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(view.submit).toHaveBeenCalledWith(expect.objectContaining({ serving_temperature: 'room', packaged_stock_quantity: quantity, direct_stock_ingredient_id: null })));
  });

  it('allows an inventory-linked product without its own stock quantity', () => {
    renderForm('', 101);
    expect(screen.getByRole('button', { name: 'Save Dish', exact: true })).toBeEnabled();
  });

  it('keeps save disabled when neither stock source is provided', () => {
    renderForm('');
    expect(screen.getByRole('button', { name: 'Save Dish', exact: true })).toBeDisabled();
  });
});
