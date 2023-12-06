import { RequestOptions } from 'nats';

export class NatsRequestRecord<TData = any> {
  constructor(
    public readonly payload: TData,
    public readonly options: RequestOptions,
  ) {}
}
