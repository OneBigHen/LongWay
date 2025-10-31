import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface YouApiLogEntry {
  timestamp: string;
  endpoint: string;
  agentId?: string;
  request: {
    origin?: string;
    destination?: string;
    method: string;
    url: string;
  };
  response: {
    status: number;
    success: boolean;
    error?: string;
  };
}

/**
 * Logs You.com API usage to a file for verification
 * Logs are stored in logs/you-api-usage.log
 */
export async function logYouApiUsage(entry: Omit<YouApiLogEntry, 'timestamp'>) {
  try {
    const logsDir = join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }
    
    const logFile = join(logsDir, 'you-api-usage.log');
    const timestamp = new Date().toISOString();
    const logEntry: YouApiLogEntry = {
      ...entry,
      timestamp,
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    await writeFile(logFile, logLine, { flag: 'a' });
  } catch (error) {
    // Don't fail requests if logging fails
    console.error('Failed to log You.com API usage:', error);
  }
}

