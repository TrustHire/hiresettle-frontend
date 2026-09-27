'use client';

import { createContext, useContext, useState } from 'react';

interface MobileSidebarCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const MobileSidebarContext = createContext<MobileSidebarCtx>({
  open: false,
  setOpen: () => {},
});

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
