import { useContext } from 'react';
import { OrderCartContext } from './OrderCartContext';

export const useOrderCart = () => {
  const context = useContext(OrderCartContext);

  if (!context) {
    throw new Error('useOrderCart must be used within OrderCartProvider');
  }

  return context;
};
