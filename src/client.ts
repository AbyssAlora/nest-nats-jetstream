import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import {
  Codec,
  JSONCodec,
  NatsConnection,
  RequestOptions,
  connect,
} from 'nats';
import { NatsJetStreamClientOptions } from '.';
import { NATS_JETSTREAM_OPTIONS } from './constants';
import { NatsJetStreamRecord } from './utils/nats-jetstream-record';
import { NatsRequestRecord } from './utils/nats-request-record';

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private natsConnection?: NatsConnection;
  private codec: Codec<JSON>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions,
  ) {
    super();
    this.codec = JSONCodec();
  }

  async connect(): Promise<NatsConnection> {
    if (!this.natsConnection) {
      this.natsConnection = await connect(this.options.connectionOptions);
    }

    return this.natsConnection;
  }

  async close() {
    await this.natsConnection?.drain();
    this.natsConnection = undefined;
  }

  protected publish(
    packet: ReadPacket,
    callback: (packet: WritePacket) => void,
  ): () => void {
    const subject = this.normalizePattern(packet.pattern);

    if (packet.data instanceof NatsRequestRecord) {
      const options: RequestOptions = packet.data.options;
      const payload = this.codec.encode(packet.data.payload);
      this.natsConnection!.request(subject, payload, options)
        .then((msg) => this.codec.decode(msg.data) as WritePacket)
        .then((packet) => callback(packet))
        .catch((err) => {
          callback({ err });
        });
      return () => null;
    } else {
      const payload = this.codec.encode(packet.data);
      this.natsConnection!.request(subject, payload)
        .then((msg) => this.codec.decode(msg.data) as WritePacket)
        .then((packet) => callback(packet))
        .catch((err) => {
          callback({ err });
        });
      return () => null;
    }
  }

  protected async dispatchEvent(
    packet: ReadPacket<NatsJetStreamRecord>,
  ): Promise<any> {
    const { jetStreamOptions } = this.options;

    const subject = this.normalizePattern(packet.pattern);

    const js = this.natsConnection!.jetstream(jetStreamOptions);

    if (packet.data instanceof NatsJetStreamRecord) {
      const payload = this.codec.encode(packet.data.payload);
      const options = packet.data.options;
      return js.publish(subject, payload, options);
    } else {
      const payload = this.codec.encode(packet.data);
      return js.publish(subject, payload);
    }
  }
}
