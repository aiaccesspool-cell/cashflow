import * as React from "react";

interface TransactionContextType {
  isAddModalOpen: boolean;
  openAddModal: () => void;
  closeAddModal: () => void;
  refreshTransactions: () => void;
  setRefreshCallback: (callback: () => void) => void;
}

const TransactionContext = React.createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [refreshCallback, setRefreshCallbackState] = React.useState<(() => void) | null>(null);

  const openAddModal = () => setIsAddModalOpen(true);
  const closeAddModal = () => setIsAddModalOpen(false);
  
  const setRefreshCallback = React.useCallback((callback: () => void) => {
    setRefreshCallbackState(() => callback);
  }, []);

  const refreshTransactions = React.useCallback(() => {
    if (refreshCallback) {
      refreshCallback();
    }
  }, [refreshCallback]);

  return (
    <TransactionContext.Provider value={{ 
      isAddModalOpen, 
      openAddModal, 
      closeAddModal, 
      refreshTransactions,
      setRefreshCallback
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const context = React.useContext(TransactionContext);
  if (context === undefined) {
    throw new Error("useTransaction must be used within a TransactionProvider");
  }
  return context;
}
