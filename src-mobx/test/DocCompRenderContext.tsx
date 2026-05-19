import React from 'react';

type DocCompRenderContextValue = {
  renderCompListByParentId: (parentId: string) => React.ReactNode[];
  renderCompById: (compId: string) => React.ReactNode;
  getCompDataById: (compId: string) => any;
};

const DocCompRenderContext = React.createContext<DocCompRenderContextValue | null>(null);

export const DocCompRenderProvider = DocCompRenderContext.Provider;

export function useDocCompRenderContext() {
  const context = React.useContext(DocCompRenderContext);
  if (!context) {
    throw new Error('useDocCompRenderContext must be used within DocCompRenderProvider');
  }
  return context;
}
