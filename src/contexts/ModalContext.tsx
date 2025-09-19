import React, { useState, ReactNode } from 'react';
import { ModalContext, ModalContextType } from './ModalContextTypes';

interface ModalState {
  isVoiceDialogOpen: boolean;
  isJsonEditorOpen: boolean;
  jsonEditorValue: Record<string, unknown>;
  jsonEditorTitle: string;
  jsonEditorOnChange: ((value: Record<string, unknown>) => void) | null;
}

// Hook moved to separate file to fix React refresh warning

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
