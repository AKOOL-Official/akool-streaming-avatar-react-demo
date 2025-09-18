import React from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useConfigurationStore } from '../../stores/configurationStore';
import JsonEditorModal from '../JsonEditorModal';
import VoiceSelectorDialog from '../VoiceSelectorDialog';
import { ApiService } from '../../apiService';

interface ModalContainerProps {
  api: ApiService | null;
}

const ModalContainer: React.FC<ModalContainerProps> = ({ api }) => {
  const {
    isVoiceDialogOpen,
    closeVoiceDialog,
    isJsonEditorOpen,
    closeJsonEditor,
    jsonEditorValue,
    jsonEditorTitle,
    jsonEditorOnChange,
  } = useModal();

  // Get voice data from store
  const { voiceId, setVoiceId } = useConfigurationStore();

  if (!api) return null;

  return (
    <>
      {/* Voice Selector Dialog */}
      <VoiceSelectorDialog
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        apiService={api}
        isOpen={isVoiceDialogOpen}
        onClose={closeVoiceDialog}
      />

      {/* JSON Editor Modal */}
      {jsonEditorOnChange && (
        <JsonEditorModal
          isOpen={isJsonEditorOpen}
          onClose={closeJsonEditor}
          value={jsonEditorValue}
          onChange={jsonEditorOnChange}
          title={jsonEditorTitle}
        />
      )}
    </>
  );
};

export default ModalContainer;
