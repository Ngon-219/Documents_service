import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService {
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Publish message to mail_service queue
   * Format matches auth_service pattern and mail_service consumer expectation
   * Creates a new connection for each publish (simple approach)
   */
  async publishToMailQueue(
    to: string,
    subject: string,
    emailData: string,
  ): Promise<boolean> {
    const rabbitmqUri = this.configService.get<string>('RABBITMQ_URI');
    if (!rabbitmqUri) {
      this.logger.warn('RABBITMQ_URI not configured, cannot send email');
      return false;
    }

    let channelModel: amqp.ChannelModel | null = null;
    let channel: amqp.Channel | null = null;

    try {
      // Create connection (amqp.connect returns ChannelModel)
      channelModel = await amqp.connect(rabbitmqUri);
      channel = await channelModel.createChannel();

      // Don't assert queue - it's already created by mail_service
      // Just publish to the existing queue
      // Queue name is 'mail_service' and it's created with durable: false

      // Format matches auth_service: { pattern: "send-email", data: { to, subject, text } }
      // Mail service consumer expects pattern "send-email" and extracts data directly
      const message = JSON.stringify({
        pattern: 'send-email',
        data: {
          to,
          subject,
          text: emailData,
        },
      });

      const sent = channel.sendToQueue(
        'mail_service',
        Buffer.from(message),
        { persistent: true },
      );

      if (sent) {
        this.logger.log(`✅ Email message published to mail_service queue for ${to}`);
        return true;
      } else {
        this.logger.warn(`Failed to publish email message for ${to} - queue might be full`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error publishing to mail_service queue:`, error);
      return false;
    } finally {
      // Clean up connection
      try {
        if (channel) {
          await channel.close();
        }
        if (channelModel) {
          await channelModel.close();
        }
      } catch (closeError) {
        this.logger.error('Error closing RabbitMQ connection:', closeError);
      }
    }
  }
}

