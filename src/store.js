import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './slices/cartSlice';
// NUEVO: Importamos el reducer de favoritos
import favoritesReducer from './slices/favoritesSlice'; 

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    // NUEVO: Lo agregamos al store
    favorites: favoritesReducer, 
  },
});