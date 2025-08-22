import { Module } from '@nestjs/common';
import { SqsModule } from 'libs/sqs/src';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsumerModule } from './consumer/consumer.module';
import { ProducerModule } from './producer/producer.module';

@Module({
  imports: [
    SqsModule.register({
      one: process.env.QUEUE_ONE!,
      two: process.env.QUEUE_TWO!
    }), 
    ConsumerModule, 
    ProducerModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
