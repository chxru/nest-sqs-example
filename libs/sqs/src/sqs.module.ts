import { Global, Module } from '@nestjs/common';
import { SqsService } from './sqs.service';
import { MetadataScanner } from '@nestjs/core';

@Global()
@Module({
  providers: [SqsService, MetadataScanner],
  exports: [SqsService],
})
export class SqsModule {}
