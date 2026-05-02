// src/config/database.ts
import mongoose, { Connection } from 'mongoose';
import config from './index';

type ConnectionMap = Record<string, Connection | undefined>;

mongoose.Promise = global.Promise as any;

const connections: ConnectionMap = {};

/**
 * Create (or reuse) a mongoose connection for the provided mongoUri.
 */
export function createConnection(mongoUri: string): Connection {
  if (!mongoUri) {
    throw new Error('mongoUri is required to create a connection');
  }

  // reuse if already created
  const existing = connections[mongoUri];
  if (existing) return existing;

  // In Mongoose v6+ the recommended default options are already applied.
  // If you need custom client options you can pass them as the second arg.
  const connection = mongoose.createConnection(mongoUri /*, optionalOptions */);

  connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log(`Database connection is open to "${mongoUri}"`);
  });

  connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error(`Database connection error to "${mongoUri}":`, err);
  });

  connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.log(`Database connection to "${mongoUri}" is disconnected`);
  });

  connections[mongoUri] = connection;
  return connection;
}

/**
 * Get the "user" DB connection from the configured uri.
 */
export function getUserDB(): Connection {
  return createConnection(config.mongodbUserUri);
}

export { connections };
export default { createConnection, getUserDB, connections };
