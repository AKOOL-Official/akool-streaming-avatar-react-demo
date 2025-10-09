# Akool Streaming Avatar React Demo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/AKOOL-Official/akool-streaming-avatar-react-demo/deploy.yml?branch=main)](https://github.com/AKOOL-Official/akool-streaming-avatar-react-demo/actions)
[![Demo](https://img.shields.io/badge/Demo-Live%20Demo-blue.svg)](https://akool-official.github.io/akool-streaming-avatar-react-demo/)

A production-ready React application showcasing Akool's Streaming Avatar service with **multi-provider support**, real-time voice interaction, and comprehensive network monitoring. Built with clean architecture principles and designed for scalability.

## 🏗️ Architecture Overview

This application demonstrates **enterprise-grade architecture** with:

- **Multi-Provider Support**: Seamless switching between Agora, LiveKit, and TRTC
- **Clean Architecture**: Layered design with clear separation of concerns
- **Design Patterns**: Strategy, Factory, Provider, Observer, and Controller patterns
- **Type Safety**: Comprehensive TypeScript implementation with strict typing
- **Event-Driven**: Reactive updates through EventBus system
- **Resource Management**: Automatic cleanup and memory management
- **Testing**: Comprehensive test coverage with modern testing frameworks

### Key Architectural Patterns

- **Strategy Pattern**: Media operations abstracted across providers
- **Factory Pattern**: Centralized provider creation and management
- **Provider Pattern**: Unified interface for different streaming SDKs
- **Observer Pattern**: Event-driven communication throughout the system
- **Controller Pattern**: Complex logic extracted into focused controllers

📖 **[View Detailed Architecture Documentation →](docs/ARCHITECTURE.md)**

## 📋 Table of Contents

- [Architecture Overview](#️-architecture-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Setup](#-api-setup)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

## ✨ Features

### Core Functionality
- 🎭 **Real-time Avatar Streaming** - Live avatar rendering with voice synchronization
- 🎤 **Voice Interaction** - Two-way voice communication with the avatar
- 💬 **Chat Interface** - Text-based messaging with the avatar
- 📊 **Network Quality Monitoring** - Real-time statistics and performance metrics
- 🌍 **Multi-language Support** - Internationalization for global users
- 🎨 **Customizable Avatars** - Multiple avatar and voice options
- 📱 **Responsive Design** - Works seamlessly across devices
- ⚡ **Low Latency** - Optimized for real-time interactions

### Advanced Features
- 🔄 **Multi-Provider Support** - Seamless switching between Agora, LiveKit, and TRTC
- 🎛️ **AI Denoiser** - Cross-provider noise reduction support
- 📈 **Performance Monitoring** - Real-time quality metrics and analytics
- 🛡️ **Error Recovery** - Robust error handling and automatic reconnection
- 🧠 **Smart Resource Management** - Automatic cleanup and memory optimization
- 🔧 **Provider-Agnostic Controls** - Unified interface across different streaming SDKs
- 🎵 **Enhanced Voice Selection** - Advanced voice preview and selection interface
- 📝 **JSON Configuration Editor** - Visual configuration management
- 🔔 **Real-time Notifications** - Toast notifications for system events
- 🎨 **Draggable UI Components** - Resizable and repositionable interface elements
- 🧪 **Comprehensive Testing** - 90%+ code coverage with Vitest
- 📊 **Advanced Analytics** - Detailed performance and usage metrics

## 🛠 Technology Stack

### Frontend Core
- **React 18** - Modern React with concurrent features
- **TypeScript** - Strict typing with comprehensive type definitions
- **Vite** - Fast build tool with hot module replacement
- **CSS3** - Modern styling with responsive design patterns

### Streaming & Communication
- **Agora RTC SDK** - Real-time communication (primary provider)
- **LiveKit Client** - WebRTC implementation (secondary provider)
- **TRTC SDK v5** - Tencent real-time communication (tertiary provider)

### State Management & Architecture
- **Zustand** - Lightweight state management for configuration
- **React Context API** - Provider state and event handling
- **EventBus** - Custom event-driven communication system
- **Resource Manager** - Automatic cleanup and memory management

### Development Tools
- **pnpm** - Fast, disk space efficient package manager
- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **Vitest** - Testing framework with coverage
- **Husky** - Git hooks for code quality


## 📋 Prerequisites

- **Node.js**: v22.11.0 or higher
- **pnpm**: Latest version (recommended package manager)
- **Akool API Token**: Valid authentication token for the Streaming Avatar service
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with WebRTC support

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AKOOL-Official/akool-streaming-avatar-react-demo
cd akool-streaming-avatar-react-demo
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.development .env.development.local
```

Edit `.env.development.local` with your configuration:

```env
VITE_OPENAPI_HOST=https://openapi.akool.com
VITE_OPENAPI_TOKEN=your_access_token_here
VITE_SERVER_BASE=/streaming/avatar

# Optional: Enable debug features (noise reduction and audio dump buttons)
# VITE_DEBUG_FEATURES=true
```

**Note:** Replace `your_access_token_here` with the token obtained from the `/api/open/v3/getToken` endpoint.

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:5173/streaming/avatar`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_OPENAPI_HOST` | Akool API base URL | `https://openapi.akool.com` | Yes |
| `VITE_OPENAPI_TOKEN` | Your Akool API authentication token | - | Yes |
| `VITE_SERVER_BASE` | Server base URL | `/streaming/avatar` | Yes |
| `VITE_DEBUG_FEATURES` | Enable debug buttons (noise reduction & audio dump) | `undefined` (disabled) | No |

### Application Settings

The demo includes configurable options for:

- **Provider Selection**: Choose between Agora, LiveKit, or TRTC
- **Avatar Selection**: Choose from available avatar models
- **Voice Settings**: Adjust voice parameters and language
- **Network Configuration**: Customize RTC settings
- **UI Preferences**: Theme and layout options

### Multi-Provider Support

The application supports **three streaming providers** with seamless switching:

- **Agora RTC** (Default) - Full audio/video support, AI denoiser
- **LiveKit** - WebRTC-based, scalable architecture  
- **TRTC** - Enterprise-grade, global CDN

📖 **[View Multi-Provider Configuration →](docs/ARCHITECTURE.md#-multi-provider-system)**

## 🔑 API Setup

### Obtaining an Akool API Token

1. **Sign Up**: Create an account at [Akool](https://akool.com)
2. **Login**: Access your account dashboard
3. **Get Credentials**: 
   - Click the picture icon in the upper right corner
   - Select "API Credentials" function
   - Set up your key pair (`clientId`, `clientSecret`) and save it
4. **Generate Token**: Use your credentials to obtain an access token via API call
5. **Use Token**: Include the token in your API requests as a Bearer token

#### Token Generation API

To get your access token, make a POST request to:

```bash
POST https://openapi.akool.com/api/open/v3/getToken
```

**Request Body:**
```json
{
  "clientId": "your_client_id_here",
  "clientSecret": "your_client_secret_here"
}
```

**Response:**
```json
{
  "code": 1000,
  "token": "your_access_token_here"
}
```

**Note:** The generated token is valid for more than 1 year.

#### Using the Token

Include your API token in the HTTP header for all API requests:

```bash
Authorization: Bearer your_access_token_here
```

### Security Best Practices

- 🔒 **Never commit API tokens** to version control
- 🔄 **Rotate tokens regularly** for enhanced security (tokens are valid for >1 year)
- 📝 **Use environment variables** for all sensitive data
- 🛡️ **Implement proper CORS** settings in production
- 🔐 **Keep clientId and clientSecret secure** - these are used to generate your access token
- ⚠️ **Production requests must be routed through your backend server** - never expose tokens in client-side code

## 🏗️ Development

### Project Structure

```
src/
├── components/          # React UI components
│   ├── shared/         # Reusable UI components
│   ├── VideoDisplay/   # Video rendering components
│   ├── ChatInterface/  # Chat functionality
│   ├── EnhancedVoiceSelector/ # Advanced voice selection
│   └── ...            # Other specialized components
├── contexts/           # React context providers  
├── hooks/              # Custom React hooks
├── providers/          # Multi-provider streaming system
│   ├── agora/          # Agora RTC implementation
│   ├── livekit/        # LiveKit implementation
│   ├── trtc/           # TRTC implementation
│   └── common/         # Shared provider components
├── core/               # Core system utilities
├── stores/             # State management (Zustand)
├── types/              # TypeScript type definitions
├── errors/             # Error handling
└── __tests__/          # Comprehensive test suite
```

📖 **[View Detailed Project Structure →](docs/ARCHITECTURE.md#-project-structure)**

### Enhanced UI Components

The application features a modern, interactive UI with advanced components:

- **Enhanced Voice Selector**: Advanced voice preview and selection with real-time audio feedback
- **JSON Configuration Editor**: Visual configuration management with Monaco Editor
- **Draggable Overlays**: Resizable and repositionable interface elements
- **Real-time Notifications**: Toast notification system for user feedback
- **Network Quality Display**: Live performance metrics and connection status
- **Chat Interface**: Modern chat UI with message history and controls
- **Video Display**: Optimized video rendering with overlay controls

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm preview          # Preview production build

# Building
pnpm build            # Build for development
pnpm build:prod       # Build for production
pnpm build:ci         # Build for CI environment

# Code Quality
pnpm lint             # Run ESLint
pnpm format           # Run prettier
pnpm typecheck        # Run TypeScript type checking

# Testing
pnpm test             # Run tests once
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Run tests with coverage
pnpm test:watch       # Run tests in watch mode

# Git Hooks
pnpm prepare          # Setup Husky git hooks
```

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/amazing-feature`
3. **Make** your changes and test thoroughly
4. **Run quality checks**:
   ```bash
   pnpm typecheck  # Type checking
   pnpm lint       # ESLint checks
   pnpm format     # Code formatting
   pnpm test       # Run tests
   ```
5. **Commit** with descriptive messages: `git commit -m 'Add amazing feature'`
6. **Push** to your branch: `git push origin feat/amazing-feature`
7. **Create** a Pull Request

### Code Quality Standards

- **TypeScript**: Strict mode enabled, never use `any` (use `unknown` instead)
- **ESLint**: Configured for React + TypeScript with strict rules
- **Prettier**: Consistent code formatting across the project
- **Testing**: Maintain 90%+ coverage for core modules, 75%+ for components
- **Error Handling**: Comprehensive try-catch blocks and error boundaries
- **No TODOs**: Never leave TODO comments or mock data in production code

## 🧪 Testing

### Testing Framework

This project uses **Vitest** as the primary testing framework with comprehensive coverage and modern testing utilities:

- **Vitest** - Fast unit testing with Vite integration
- **React Testing Library** - Component testing utilities
- **Jest DOM** - Custom matchers for DOM testing
- **User Event** - User interaction simulation
- **Coverage Reports** - Comprehensive code coverage tracking

### Test Structure

```
src/__tests__/
├── core/              # Core system tests
├── fixtures/          # Test data and fixtures
├── mocks/             # Mock implementations
│   └── streamingSdks/ # Provider SDK mocks
└── setup/             # Test configuration
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Coverage Requirements

The project maintains high code coverage with different thresholds:

- **Core Modules** (hooks, providers, core): 90% coverage
- **UI Components**: 75% coverage
- **Global Threshold**: 80% coverage

### Test Categories

#### Unit Tests
- **Component Tests**: UI component behavior and rendering
- **Hook Tests**: Custom React hooks functionality
- **Provider Tests**: Streaming provider implementations
- **Core Tests**: EventBus, Logger, ResourceManager

#### Integration Tests
- **Provider Switching**: Multi-provider functionality
- **Error Scenarios**: Network failure and recovery
- **Performance Tests**: Load and stress testing

### Mock Strategy

- **Provider SDKs**: Complete mock implementations for Agora, LiveKit, and TRTC
- **Event System**: Mock EventBus for isolated testing
- **API Services**: Mocked API responses and error scenarios

## 📊 Network Quality Monitoring

The application provides comprehensive real-time monitoring with provider-agnostic metrics:

- **Video Statistics**: Frame rate, resolution, bitrate, codec information
- **Audio Statistics**: Sample rate, bitrate, packet loss, volume levels  
- **Network Performance**: Latency, jitter, packet loss rates, bandwidth
- **Connection Quality**: Overall network health score (0-100)
- **AI Denoiser**: Cross-provider noise reduction support
- **Error Recovery**: Automatic reconnection with exponential backoff

📖 **[View Performance Optimizations →](docs/ARCHITECTURE.md#-performance-optimizations)**

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |

## 🚀 Deployment

### Production Build

```bash
pnpm build:prod
```

### Deployment Options

#### Static Hosting (Netlify, Vercel, etc.)

1. Build the application: `pnpm build:prod`
2. Upload the `dist` folder to your hosting provider
3. Configure environment variables in your hosting platform
4. Set up custom domain if needed

#### Docker Deployment

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .
RUN pnpm build:prod

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🔧 Troubleshooting

### Common Issues

#### 1. API Token Authentication Error

**Problem**: "Invalid API token" or "Authentication failed"

**Solution**:
- Verify your API token is correct
- Check if the token has expired
- Ensure the token has proper permissions

#### 2. WebRTC Connection Issues

**Problem**: Avatar not loading or voice not working

**Solution**:
- Check browser WebRTC support
- Verify microphone permissions
- Check firewall/network restrictions
- Try refreshing the page

#### 3. Network Quality Problems

**Problem**: Poor video/audio quality

**Solution**:
- Check internet connection speed
- Close other bandwidth-intensive applications
- Try different network (mobile hotspot)
- Check browser console for errors

#### 4. Development Server Issues

**Problem**: `pnpm dev` fails to start

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check Node.js version
node --version  # Should be >= 22.11.0
```

### Getting Help

- 📖 **Documentation**: [Akool API Docs](https://docs.akool.com)
- 🔐 **Authentication Guide**: [Akool Authentication Usage](https://docs.akool.com/authentication/usage)
- 💬 **Community**: [GitHub Discussions](https://github.com/AKOOL-Official/akool-streaming-avatar-react-demo/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/AKOOL-Official/akool-streaming-avatar-react-demo/issues)
- 📧 **Support**: info@akool.com

### Development Setup

1. **Fork** and clone the repository
2. **Install** dependencies: `pnpm install`
3. **Create** a feature branch
4. **Make** your changes
5. **Test** thoroughly
6. **Submit** a pull request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Akool](https://akool.com) for providing the Streaming Avatar API
- [Agora](https://agora.io) for real-time communication technology
- [React](https://reactjs.org) community for the amazing framework
- All contributors who help improve this demo

---

**Made with ❤️ by the Akool Team**
