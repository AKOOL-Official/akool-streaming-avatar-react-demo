import axios from 'axios';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface GptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const sendGptMessage = async (
  apiKey: string,
  messages: GptMessage[],
  systemPrompt: string = "You are a helpful assistant.",
  model: string = "gpt-4o-mini"
): Promise<string> => {
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const requestData: ChatCompletionRequest = {
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      ...messages,
    ],
    stream: false
  };

  try {
    const response = await axios.post<ChatCompletionResponse>(
      'https://api.openai.com/v1/chat/completions',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
};