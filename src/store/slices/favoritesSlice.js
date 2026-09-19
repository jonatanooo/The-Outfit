import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // Aquí guardaremos las prendas favoritas
  isFavoritesOpen: false, // Controla si el panel lateral de favoritos está abierto
};

export const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    toggleFavorite: (state, action) => {
      // Buscamos si la prenda ya está en favoritos
      const existingIndex = state.items.findIndex((item) => item.id === action.payload.id);
      
      if (existingIndex >= 0) {
        // Si ya existe, la quitamos (al darle clic al corazón por segunda vez)
        state.items.splice(existingIndex, 1);
      } else {
        // Si no existe, la agregamos a la lista
        state.items.push(action.payload);
      }
    },
    toggleFavoritesOpen: (state) => {
      state.isFavoritesOpen = !state.isFavoritesOpen;
    },
  },
});

export const { toggleFavorite, toggleFavoritesOpen } = favoritesSlice.actions;
export default favoritesSlice.reducer;