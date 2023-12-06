import { DynamicModule } from '@nestjs/common';
import { NatsJetStreamClientAsyncOptions, NatsJetStreamClientOptions } from '.';
import { NatsJetStreamClientProxy } from './client';
import { NATS_JETSTREAM_OPTIONS } from './constants';

export class NatsJetStreamModule {
  static register(options: NatsJetStreamClientOptions): DynamicModule {
    const providers = [
      {
        provide: NATS_JETSTREAM_OPTIONS,
        useValue: options,
      },
      NatsJetStreamClientProxy,
    ];

    return {
      providers,
      exports: providers,
      module: NatsJetStreamModule,
    };
  }

  static registerAsync(
    options: NatsJetStreamClientAsyncOptions,
  ): DynamicModule {
    return {
      module: NatsJetStreamModule,
      imports: options.imports,
      providers: [
        {
          provide: NATS_JETSTREAM_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        NatsJetStreamClientProxy,
      ],
      exports: [NatsJetStreamClientProxy],
    };
  }
}
