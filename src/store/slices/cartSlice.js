import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], 
  isCartOpen: false, 
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const existingItem = state.items.find(
        (item) => item.id === action.payload.id && item.talla === action.payload.talla
      );
      if (existingItem) {
        existingItem.cantidad += 1;
      } else {
        state.items.push({ ...action.payload, cantidad: 1 });
      }
    },
    // NUEVO: Acción para eliminar productos
    removeFromCart: (state, action) => {
      state.items = state.items.filter(
        (item) => !(item.id === action.payload.id && item.talla === action.payload.talla)
      );
    },
    toggleCart: (state) => {
      state.isCartOpen = !state.isCartOpen; 
    },
  },
});

// Asegúrate de exportar también removeFromCart
export const { addToCart, removeFromCart, toggleCart } = cartSlice.actions;
export default cartSlice.reducer;