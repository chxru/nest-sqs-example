import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { STATIC_CONTEXT } from "@nestjs/core/injector/constants";
import { SQS_CONSUMER } from './sqs.decorator';
import { SqsOptions } from './sqs.types';
import { DeleteMessageBatchCommand, ReceiveMessageCommand, SQSClient} from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name)
  private queueHandlerMap: QueueHandlerMap = {};
  private readonly sqsClient: SQSClient;
  
  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
    private readonly queueUrls: string[],
    private readonly sqsOptions?: SqsOptions
  ) {
    this.sqsClient = new SQSClient(sqsOptions || {})
  }

  async onModuleInit() {
    // if there is no queues, do not go further
    if (!this.queueUrls.length) {
      this.logger.warn("You are initiating SqsModule without providing any URLs. Module will not initiate further")
      return;
    }

    // check of active listeners
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
            continue;
          }

          const url: string = meta["url"]
          if (!url || typeof url !== "string") {
            this.logger.fatal("Queue url must be a string, received", {url});
            continue
          }

          this.logger.debug(`Found a sqs handler for ${url}`)

          if (url in this.queueHandlerMap) {
            this.logger.warn(`Overriding ${url} handler from ${this.queueHandlerMap[url].handler.name} to ${handler.name}`)
          }

          this.queueHandlerMap[url] = {instance, handler};
        }
      }
    }

    // initiate listening
    for (const url of Object.keys(this.queueHandlerMap)) {
      this.initiateListening(url)
    }
  }

  private async initiateListening(url: string, retry: number = 0) {
    // add a latency if its a retry 
    if (retry > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000 * retry) )
    }

    this.logger.log(`Starting listening to ${url}`)

    while (true) {
      try {
        const receiveCmd = new ReceiveMessageCommand({
          QueueUrl: url,
          MaxNumberOfMessages: 10,
        })
        const receiveRes = await this.sqsClient.send(receiveCmd)
        const messages = receiveRes.Messages

        if (!messages || !messages.length) {
          continue
        }

        const {handler, instance} = this.queueHandlerMap[url]
        const okayMsgIds: string[] = await handler.call(instance, messages);

        if (!Array.isArray(okayMsgIds)) {
          this.logger.error("SqsConsumer decored function should return successful message ids, received", okayMsgIds)
          continue;
        }

        const deleteCmd = new DeleteMessageBatchCommand({
          QueueUrl: url,
          Entries: okayMsgIds.map((msgId, idx) => ({
            Id: `message-${idx}`,
            ReceiptHandle: msgId,
          }))
        })
        const deleteRes = await this.sqsClient.send(deleteCmd)  
        if (deleteRes.Failed?.length) {
          for (const failedDelete of deleteRes.Failed) {
            this.logger.error("Failed to delete the message from sqs", failedDelete)
          }
        }
      } catch (e) {
        this.logger.error(`An error occurred while reading queue ${url}`, e)
      }
    }

    this.logger.log(`Restarting ${url} listener`)
    this.initiateListening(url)
  }
}

type QueueHandlerMap = Record<string, {instance: object, handler: HandlerFunction}>
type HandlerFunction<T = void> = () => Promise<T> 
