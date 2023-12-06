import {
  ConnectionOptions,
  ConsumerConfig,
  JetStreamManagerOptions,
  JetStreamOptions,
  StreamConfig,
  SubscriptionOptions,
} from 'nats';

export interface NatsJetStreamServerOptions {
  connectionOptions: ConnectionOptions;
  jetStreamManagerOptions?: JetStreamManagerOptions | undefined;
  jetStramOptions?: JetStreamOptions | undefined;
  streamConfig: Partial<StreamConfig>;
  consumerConfig?: Partial<ConsumerConfig>;
  subscriptionOptions?: Omit<SubscriptionOptions, 'callback'>;
}
