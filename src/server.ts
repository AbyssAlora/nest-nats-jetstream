import {
  CustomTransportStrategy,
  Server,
  Transport,
} from '@nestjs/microservices';
import {
  Codec,
  JSONCodec,
  JetStreamClient,
  JetStreamManager,
  NatsConnection,
  connect,
} from 'nats';
import { from } from 'rxjs';
import { NatsJetStreamServerOptions } from './interfaces';
import { NatsContext, NatsJetStreamContext } from './nats-jetstream-context';
import { uniqueNameFrom } from './utils/utils';

export class NatsJetStreamServer
  extends Server
  implements CustomTransportStrategy
{
  transportId?: symbol | Transport | undefined;

  private readonly codec: Codec<JSON>;

  private natsConnection?: NatsConnection;
  private jetStreamManager?: JetStreamManager;

  constructor(private readonly options: NatsJetStreamServerOptions) {
    super();
    this.codec = JSONCodec();
  }

  async listen(callback: () => void) {
    if (!this.natsConnection) {
      this.natsConnection = await connect(this.options.connectionOptions);
    }

    this.jetStreamManager = await this.natsConnection.jetstreamManager(
      this.options.jetStreamManagerOptions,
    );

    await this.setupStream();
    await this.bindEventHandlers();
    await this.bindMessageHandlers();

    callback();
  }

  async close() {
    await this.natsConnection?.drain();
    this.natsConnection = undefined;
  }

  private async bindEventHandlers() {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => handler.isEventHandler,
    );

    const jetStream = this.natsConnection!.jetstream(
      this.options.jetStramOptions,
    );

    for (const [subject, eventHandler] of eventHandlers) {
      const consumer = await this.getOrCreateConsumer(jetStream, subject);

      if (!consumer) {
        continue;
      }

      this.logger.log(`Subscribed to ${subject} events`);

      const messages = await consumer.consume();
      const done = async () => {
        for await (const msg of messages) {
          try {
            const data = this.codec.decode(msg.data);
            const context = new NatsJetStreamContext([msg]);
            this.send(from(eventHandler(data, context)), () => null);
          } catch (err) {
            if (err instanceof Error) {
              this.logger.error(err.message, err.stack);
            } else {
              this.logger.error(err);
            }
            msg.term();
          }
        }
      };

      done().then(() => {
        if (
          this.natsConnection!.isDraining() ||
          this.natsConnection!.isClosed()
        ) {
          return;
        }

        consumer.delete();

        this.logger.log(`Unsubscribed ${subject}`);
      });
    }
  }

  private async bindMessageHandlers() {
    const messageHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => !handler.isEventHandler,
    );

    for (const [subject, messageHandler] of messageHandlers) {
      this.natsConnection!.subscribe(subject, {
        ...this.options.subscriptionOptions,
        callback: async (err, msg) => {
          if (err) {
            return this.logger.error(err.message, err.stack);
          }
          const payload = this.codec.decode(msg.data);
          const context = new NatsContext([msg]);
          const response = this.transformToObservable(
            messageHandler(payload, context),
          );
          this.send(response, (_response) =>
            msg.respond(this.codec.encode(_response as JSON)),
          );
        },
      });

      this.logger.log(`Subscribed to ${subject} messages`);
    }
  }

  private async setupStream() {
    const { streamConfig } = this.options;

    const streams = await this.jetStreamManager!.streams.list().next();
    const stream = streams.find(
      (stream) => stream.config.name === streamConfig.name,
    );

    if (stream) {
      const streamSubjects = new Set([...(streamConfig.subjects ?? [])]);

      const streamInfo = await this.jetStreamManager!.streams.update(
        stream.config.name,
        {
          ...stream.config,
          ...streamConfig,
          subjects: [...streamSubjects.keys()],
        },
      );

      this.logger.log(`Stream ${streamInfo.config.name} updated`);
    } else {
      const streamInfo = await this.jetStreamManager!.streams.add(streamConfig);

      this.logger.log(`Stream ${streamInfo.config.name} created`);
    }
  }

  private async getOrCreateConsumer(
    jetStream: JetStreamClient,
    subject: string,
  ) {
    const { streamConfig, consumerConfig } = this.options;

    if (!consumerConfig) {
      return null;
    }

    const consumers = await this.jetStreamManager!.consumers.list(
      streamConfig.name!,
    ).next();

    const durable_name = consumerConfig.durable_name
      ? uniqueNameFrom(consumerConfig.durable_name, subject)
      : undefined;

    const name = consumerConfig.name
      ? uniqueNameFrom(consumerConfig.name, subject)
      : undefined;

    const consumerInfo = consumers.find((consumer) => {
      if (!consumerConfig.durable_name) {
        return false;
      }
      return consumer.config.durable_name == durable_name;
    });

    const cfg = {
      ...consumerConfig,
      name: name,
      durable_name: durable_name,
    };

    if (consumerInfo) {
      await this.jetStreamManager?.consumers.update(
        streamConfig.name!,
        durable_name!,
        { ...cfg, filter_subject: subject },
      );

      this.logger.log(
        `Consumer ${
          consumerConfig?.name ?? consumerConfig?.durable_name
        } updated`,
      );
    } else {
      await this.jetStreamManager?.consumers.add(streamConfig.name!, {
        ...cfg,
        filter_subject: subject,
      });

      this.logger.log(
        `Consumer ${
          consumerConfig.durable_name ?? consumerConfig.name
        } created`,
      );
    }

    return await jetStream.consumers.get(
      streamConfig.name!,
      durable_name ?? name,
    );
  }
}
