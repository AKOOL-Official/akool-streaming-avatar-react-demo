import { createContext } from 'react';

export interface ModalContextType {
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

export const ModalContext = createContext<ModalContextType | undefined>(undefined);
