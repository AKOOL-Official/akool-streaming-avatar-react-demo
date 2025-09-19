export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  file?: string;
}

export interface LogOutput {
  write(entry: LogEntry): void;
}

// Console output (for development)
export class ConsoleLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const file = entry.file ? ` [${entry.file}]` : '';

    const logMessage = `[${timestamp}] ${levelName}${file}: ${entry.message}${context}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(logMessage);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(logMessage);
    }
  }
}

// Memory output (for testing and debugging)
export class MemoryLogOutput implements LogOutput {
  private logs: LogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  write(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only the most recent entries
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  getLogsForLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  getLogsSince(timestamp: number): LogEntry[] {
    return this.logs.filter((log) => log.timestamp >= timestamp);
  }
}

// No-op output (for production when logging is disabled)
export class NoOpLogOutput implements LogOutput {
  write(_entry: LogEntry): void {
    // Intentionally empty
  }
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = this.parseLogLevel(import.meta.env.VITE_LOG_LEVEL) ?? LogLevel.INFO;
  private outputs: LogOutput[] = [];
  private memoryOutput?: MemoryLogOutput;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  constructor() {
    // Initialize with memory output for debugging
    this.memoryOutput = new MemoryLogOutput();
    this.outputs.push(this.memoryOutput);

    // Add console output in development
    if (process.env.NODE_ENV === 'development') {
      this.outputs.push(new ConsoleLogOutput());
    }
  }

  private parseLogLevel(levelString?: string): LogLevel | null {
    if (!levelString) return null;

    const normalizedLevel = levelString.toLowerCase().trim();

    switch (normalizedLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default: {
        // Try to parse as number for backward compatibility
        const numericLevel = parseInt(levelString);
        if (!isNaN(numericLevel) && numericLevel >= 0 && numericLevel <= 3) {
          return numericLevel as LogLevel;
        }
        return null;
      }
    }
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  removeOutput(output: LogOutput): void {
    const index = this.outputs.indexOf(output);
    if (index > -1) {
      this.outputs.splice(index, 1);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      file: this.getCallerFile(),
    };

    this.outputs.forEach((output) => {
      try {
        output.write(entry);
      } catch (error) {
        // Fallback for critical errors - only use console.error here
        if (typeof window !== 'undefined' && window.console) {
          // eslint-disable-next-line no-console
          console.error('Logger output error:', error);
        }
      }
    });
  }

  private getCallerFile(): string {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        // Look for the first line that's not in the logger
        for (let i = 4; i < lines.length; i++) {
          const line = lines[i];
          if (line && !line.includes('Logger.ts') && !line.includes('logger.ts')) {
            const match = line.match(/\/([^/]+):\d+:\d+/);
            if (match) {
              // Remove query parameters (e.g., ?t=1757646098104) from filename
              const filename = match[1];
              if (filename) {
                const cleanFilename = filename.split('?')[0];
                return cleanFilename || 'unknown';
              }
            }
            return 'unknown';
          }
        }
      }
    } catch {
      // Ignore errors in getting caller file
    }
    return 'unknown';
  }

  // Utility methods
  getLogs(): LogEntry[] {
    return this.memoryOutput?.getLogs() || [];
  }

  clearLogs(): void {
    this.memoryOutput?.clear();
  }

  getLogsForLevel(level: LogLevel): LogEntry[] {
    return this.memoryOutput?.getLogsForLevel(level) || [];
  }

  getLogsSince(timestamp: number): LogEntry[] {
    return this.memoryOutput?.getLogsSince(timestamp) || [];
  }

  // Configuration methods
  enableConsoleOutput(): void {
    // Remove existing console output
    this.outputs = this.outputs.filter((output) => !(output instanceof ConsoleLogOutput));
    // Add new console output
    this.outputs.push(new ConsoleLogOutput());
  }

  disableConsoleOutput(): void {
    this.outputs = this.outputs.filter((output) => !(output instanceof ConsoleLogOutput));
  }

  enableMemoryOutput(maxEntries = 1000): void {
    if (!this.memoryOutput) {
      this.memoryOutput = new MemoryLogOutput(maxEntries);
      this.outputs.push(this.memoryOutput);
    }
  }

  disableMemoryOutput(): void {
    if (this.memoryOutput) {
      this.removeOutput(this.memoryOutput);
      this.memoryOutput = undefined;
    }
  }
}

export const logger = Logger.getInstance();
