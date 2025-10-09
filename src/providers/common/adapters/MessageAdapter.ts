// Interface for provider-specific message operations

export interface MessageAdapter {
  /**
   * Send data to the remote participants
   * @param data - The data to send as Uint8Array
   */
  sendData(data: Uint8Array): Promise<void>;

  /**
   * Check if the adapter is ready to send messages
   * @returns true if ready, false otherwise
   */
  isReady(): boolean;

  /**
   * Set up message listener for incoming messages
   * @param callback - Callback function to handle incoming data
   */
  setupMessageListener(callback: (data: Uint8Array) => void): void;

  /**
   * Remove message listener
   */
  removeMessageListener(): void;

  /**
   * Clean up resources
   */
  cleanup(): void;
}
