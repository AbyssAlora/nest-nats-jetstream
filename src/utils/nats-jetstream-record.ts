import { JetStreamPublishOptions } from 'nats';

export class NatsJetStreamRecord<TData = any> {
  constructor(
    public readonly payload: TData,
    public readonly options: Partial<JetStreamPublishOptions>,
  ) {}
}
