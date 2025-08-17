import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { STATIC_CONTEXT } from "@nestjs/core/injector/constants";
import { SQS_CONSUMER } from './sqs.decorator';

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name)
  private handlers: {instance: object, handler: HandlerFunction}[] = [];
  
  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner
  ) {}

  async onModuleInit() {
    const components = this.modulesContainer.entries();
    for (const [_, component] of components) {
      const providers = component.providers

      for (const [_, provider] of providers) {
        const wrapper = provider.getInstanceByContextId(STATIC_CONTEXT, provider.id)

        if (wrapper.isPending && !wrapper.isResolved) {
          await wrapper.donePromise
        }

        const instance = wrapper.instance
        if (!instance || typeof instance !== "object") {
          continue
        }

        const prototype = Object.getPrototypeOf(instance)
        const methods = this.metadataScanner.getAllMethodNames(prototype)
  
        for (const method of methods) {
          const handler: HandlerFunction = prototype[method]
          const meta = Reflect.getMetadata(SQS_CONSUMER, handler)
          if (!meta) {
            continue;
          }

          if (typeof meta !== "object" && !("url" in meta)) {
            this.logger.fatal("Incorrect metadata passed to SqsConsumer decorator. Expected an object with key, received", meta);
          }

          this.logger.debug(`Found a sqs handler for ${meta["url"]}`)
          this.handlers.push({ instance, handler })
        }
      }
    }  
  }

  async notifyAll() {
    for (const {instance, handler} of this.handlers) {
      handler.call(instance, "hello")
    }
  }
}

type HandlerFunction<T = void> = () => Promise<T> 
