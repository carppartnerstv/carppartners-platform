import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

// Las pestañas de expo-router mantienen montada cada pantalla al cambiar de
// tab (no se desmonta), así que el scroll se quedaba donde lo dejaste la
// última vez — bug ya corregido en el diseño de referencia. Cada pantalla
// con scroll llama a este hook pasando una función que lleve su ScrollView/
// FlatList a 0; se ejecuta cada vez que la pantalla recupera el foco (cambio
// de pestaña o vuelta atrás en el stack).
export function useResetScrollOnFocus(resetFn: () => void) {
  useFocusEffect(
    useCallback(() => {
      resetFn();
      // Solo nos interesa en el momento del foco, no en cada cambio de resetFn
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}
