import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './routes/documents';
import { AuthModule } from './auth/auth.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM module (shared database with auth_service)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Auth module (JWT authentication & authorization)
    AuthModule,

    // RabbitMQ module
    RabbitMQModule,

    // Feature modules
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
