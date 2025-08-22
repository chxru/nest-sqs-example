import { DynamicModule, Global, Module } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { SqsService } from './sqs.service';
import { SqsOptions } from './sqs.types';

@Global()
@Module({
  providers: [SqsService, MetadataScanner],
  exports: [SqsService],
})
export class SqsModule {
  public static register(queueNameUrlMap: Record<string, string>, sqsOptions?: SqsOptions): DynamicModule {
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
              return new SqsService(modulesContainer, metadataScanner, queueNameUrlMap, sqsOptions)
          },
          inject: [ModulesContainer, MetadataScanner]
        }
      ],
      exports: [SqsService]
    }
  }
}
