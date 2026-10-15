import { describe, expect, it } from 'vitest';
import productReducer, {
  addProductRow,
  removeProductRow,
  updateProductRow,
  setProductItems,
  resetProductItems,
} from './productSlice';

describe('productSlice reducers and PCF calculation', () => {
  it('automatically calculates pcfDensity when dimensions and weight are updated with 0 pallets', () => {
    let state = productReducer(undefined, { type: 'unknown' });
    const id = state.items[0].id;

    state = productReducer(state, updateProductRow({ id, field: 'length', value: 40 }));
    state = productReducer(state, updateProductRow({ id, field: 'width', value: 48 }));
    state = productReducer(state, updateProductRow({ id, field: 'height', value: 60 }));
    state = productReducer(state, updateProductRow({ id, field: 'weight', value: 1000 }));
    state = productReducer(state, updateProductRow({ id, field: 'pallets', value: 0 }));

    // volume = (40 * 48 * 60) / 1728 = 66.67
    // pallet = 0 => PCF = 1000 / 66.67 = 15.00
    expect(state.items[0].pcfDensity).toBe('15.00');
  });

  it('automatically calculates pcfDensity when pallets > 0', () => {
    let state = productReducer(undefined, { type: 'unknown' });
    const id = state.items[0].id;

    state = productReducer(state, updateProductRow({ id, field: 'length', value: 40 }));
    state = productReducer(state, updateProductRow({ id, field: 'width', value: 48 }));
    state = productReducer(state, updateProductRow({ id, field: 'height', value: 60 }));
    state = productReducer(state, updateProductRow({ id, field: 'weight', value: 1000 }));
    state = productReducer(state, updateProductRow({ id, field: 'pallets', value: 2 }));

    // volume = 66.67, weight per pallet = 500 => PCF = 7.50
    expect(state.items[0].pcfDensity).toBe('7.50');
  });

  it('allows manual override of pcfDensity', () => {
    let state = productReducer(undefined, { type: 'unknown' });
    const id = state.items[0].id;

    state = productReducer(state, updateProductRow({ id, field: 'pcfDensity', value: '12.34' }));
    expect(state.items[0].pcfDensity).toBe('12.34');
  });

  it('calculates pcfDensity in setProductItems if not already set', () => {
    const items = [
      {
        id: 'item-1',
        pallets: 1,
        pieces: 1,
        packageType: 'Pallet',
        description: 'Test',
        stackable: false,
        hazmat: false,
        nmfc: '123456-01',
        length: 48,
        width: 40,
        height: 48,
        pcfDensity: '',
        class: '70',
        weight: 500,
      },
    ];

    const state = productReducer(undefined, setProductItems(items));
    expect(state.items[0].pcfDensity).toBe('9.38');
  });
});
