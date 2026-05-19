import React from 'react';
import type { DocStore } from './docStore';

type DocStoreContextValue = {
  store: DocStore;
  docId: string;
};

const DocStoreContext = React.createContext<DocStoreContextValue | null>(null);

export function DocStoreProvider({
  value,
  children,
}: {
  value: DocStoreContextValue;
  children: React.ReactNode;
}) {
  return <DocStoreContext.Provider value={value}>{children}</DocStoreContext.Provider>;
}

export function useDocStoreContext() {
  return React.useContext(DocStoreContext);
}

