import React from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useConfigurationStore } from '../../stores/configurationStore';
import JsonEditorModal from '../JsonEditorModal';
import VoiceSelectorDialog from '../VoiceSelectorDialog';
import { ApiService } from '../../apiService';

interface ModalContainerProps {
  api: ApiService | null;
  isJoined: boolean;
}

const ModalContainer: React.FC<ModalContainerProps> = ({ api, isJoined }) => {
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
  const { voiceId, setVoiceId, voiceUrl, setVoiceUrl } = useConfigurationStore();

  if (!api) return null;

  return (
    <>
      {/* Voice Selector Dialog */}
      <VoiceSelectorDialog
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        voiceUrl={voiceUrl}
        setVoiceUrl={setVoiceUrl}
        apiService={api}
        disabled={isJoined}
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
