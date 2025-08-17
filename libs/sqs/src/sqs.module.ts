import { DynamicModule, Global, Module } from '@nestjs/common';
import { SqsService } from './sqs.service';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { SqsOptions } from './sqs.types';

@Global()
@Module({
  providers: [SqsService, MetadataScanner],
  exports: [SqsService],
})
export class SqsModule {
  public static register(queueUrls: string[],sqsOptions?: SqsOptions): DynamicModule {
    return {
      global: true,
      module: SqsModule,
      providers: [
        {
          provide: SqsService,
          useFactory: (
            modulesContainer: ModulesContainer,
            metadataScanner: MetadataScanner,
          ) => {
              return new SqsService(modulesContainer, metadataScanner, queueUrls, sqsOptions)
          },
          inject: [ModulesContainer, MetadataScanner]
        }
      ],
      exports: [SqsService]
    }
  }
}
