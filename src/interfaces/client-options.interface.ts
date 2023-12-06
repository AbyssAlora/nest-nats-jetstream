import { ModuleMetadata } from '@nestjs/common';
import { ConnectionOptions, JetStreamOptions } from 'nats';

export interface NatsJetStreamClientOptions {
  connectionOptions: ConnectionOptions;
  jetStreamOptions?: JetStreamOptions | undefined;
}

export interface NatsJetStreamClientAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<NatsJetStreamClientOptions> | NatsJetStreamClientOptions;
  inject?: any[];
}
