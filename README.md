# Quick Demo for Akool Streaming Avatar Demo in Web

## Setup

install dependencies 
install node.js v22.11.0

```bash
npm install vite --save-dev
npm i
```

run Streaming avatar demo

```bash
npm run dev
```

build Streaming avatar demo

```bash
npm run build
```


## Environment Variables

copy .env.example to .env and fill in the values

or use the following values

```bash
VITE_OPENAPI_TOKEN="your-openapi-token"
VITE_GPT_TOKEN="your-gpt-token"
```

## Notes


- The OpenAI token is used to authenticate with the Akool API. It's a JWT token which can be generated using the Akool clientId and clientSecret. For more information, please refer to the [Akool API documentation](https://docs.akool.io/authentication/usage#get-the-token).
- The GPT token is used to authenticate with the GPT API. It's optional, but if you want to use the GPT chat, you need to provide a valid GPT token.
- The OpenAI token is required to generate the avatar.
- The GPT token is required to use the GPT chat.
- Most of the values are stored in the VideoChatContext.tsx file. It's a React context that provides the values to the components. You can change the values in the context to see the changes in the UI.
- The demo uses tailwindcss for styling and shadcn/ui for components. You can change the styles and components to your own.