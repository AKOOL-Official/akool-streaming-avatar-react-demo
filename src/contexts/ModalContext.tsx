import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalState {
  isVoiceDialogOpen: boolean;
  isJsonEditorOpen: boolean;
  jsonEditorValue: Record<string, unknown>;
  jsonEditorTitle: string;
  jsonEditorOnChange: ((value: Record<string, unknown>) => void) | null;
}

interface ModalContextType {
  // Voice Dialog
  openVoiceDialog: () => void;
  closeVoiceDialog: () => void;
  isVoiceDialogOpen: boolean;

  // JSON Editor
  openJsonEditor: (
    value: Record<string, unknown>,
    onChange: (value: Record<string, unknown>) => void,
    title?: string,
  ) => void;
  closeJsonEditor: () => void;
  isJsonEditorOpen: boolean;
  jsonEditorValue: Record<string, unknown>;
  jsonEditorTitle: string;
  jsonEditorOnChange: ((value: Record<string, unknown>) => void) | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    isVoiceDialogOpen: false,
    isJsonEditorOpen: false,
    jsonEditorValue: {},
    jsonEditorTitle: 'Edit JSON',
    jsonEditorOnChange: null,
  });

  const openVoiceDialog = () => {
    setModalState((prev) => ({ ...prev, isVoiceDialogOpen: true }));
  };

  const closeVoiceDialog = () => {
    setModalState((prev) => ({ ...prev, isVoiceDialogOpen: false }));
  };

  const openJsonEditor = (
    value: Record<string, unknown>,
    onChange: (value: Record<string, unknown>) => void,
    title: string = 'Edit JSON',
  ) => {
    setModalState((prev) => ({
      ...prev,
      isJsonEditorOpen: true,
      jsonEditorValue: value,
      jsonEditorTitle: title,
      jsonEditorOnChange: onChange,
    }));
  };

  const closeJsonEditor = () => {
    setModalState((prev) => ({
      ...prev,
      isJsonEditorOpen: false,
      jsonEditorValue: {},
      jsonEditorTitle: 'Edit JSON',
      jsonEditorOnChange: null,
    }));
  };

  const value: ModalContextType = {
    openVoiceDialog,
    closeVoiceDialog,
    isVoiceDialogOpen: modalState.isVoiceDialogOpen,
    openJsonEditor,
    closeJsonEditor,
    isJsonEditorOpen: modalState.isJsonEditorOpen,
    jsonEditorValue: modalState.jsonEditorValue,
    jsonEditorTitle: modalState.jsonEditorTitle,
    jsonEditorOnChange: modalState.jsonEditorOnChange,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};
