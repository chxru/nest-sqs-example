import { DeleteMessageBatchCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { STATIC_CONTEXT } from "@nestjs/core/injector/constants";
import { SQS_CONSUMER, type SqsConsumerParams } from './sqs.decorator';
import { SqsOptions } from './sqs.types';

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name)
  private queueHandlerMap: QueueHandlerMap = {};
  private readonly sqsClient: SQSClient;
  
  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
    private readonly queueNameUrlMap: Record<string, string>,
    private readonly sqsOptions?: SqsOptions
  ) {
    this.sqsClient = new SQSClient(sqsOptions || {})
  }

  async onModuleInit() {
    // check of active listeners
    const components = this.modulesContainer.entries();
    for (const [, component] of components) {
      const providers = component.providers

      for (const [, provider] of providers) {
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
          const meta = Reflect.getMetadata(SQS_CONSUMER, handler) as SqsConsumerParams
          if (!meta) {
            continue;
          }

          if (typeof meta !== "object") {
            this.logger.fatal("Expected decorator parameter is a Record<string, string>, received", meta)
            continue;
          }

          const queueName = meta.name
          const queueUrl = meta.url

          let url: string;
          if (queueName && queueUrl) {
            this.logger.warn(`both queueName and queueUrl is provided in ${meta}, defaulting to url`)

            url = queueUrl
          } else if (queueName) {
            if (!Object.hasOwn(this.queueNameUrlMap, queueName)) {
              this.logger.error(`Cannot find a queue url for name ${queueName})`)
              continue
            }
            url = this.queueNameUrlMap[queueName]
          } else {
            if (!queueUrl) {
              this.logger.error("Queue url or name should be passed in the decorator")
              continue;
            }

            url = queueUrl
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
      this.logger.log(`Retrying ${url} in ${10 * retry} seconds`)
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000 * retry) )
    }

    this.logger.log(`Starting listening to ${url}`)

    while (true) {
      try {
        const receiveCmd = new ReceiveMessageCommand({
          QueueUrl: url,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 10, // enables long polling
        })
        const receiveRes = await this.sqsClient.send(receiveCmd)
        const messages = receiveRes.Messages

        if (!messages || !messages.length) {
          continue
        }

        const {handler, instance} = this.queueHandlerMap[url]

        const warnTimeInSeconds = 2;
        const stuckedMsgProcessingTimeout = setTimeout(() => {
          this.logger.warn(`Messages from ${url} has being waiting for ${warnTimeInSeconds}s to be finished`)
        }, warnTimeInSeconds * 1000)
        
        const okayMsgIds: string[] = await handler.call(instance, messages);

        clearTimeout(stuckedMsgProcessingTimeout)

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
        break;
      }
    }

    this.logger.log(`Restarting ${url} listener`)
    this.initiateListening(url, ++retry)
  }

  async produce(url: string, message: any) {
    const sendCmd = new SendMessageCommand({
      QueueUrl: url,
      MessageBody: message
    })

    await this.sqsClient.send(sendCmd)
  }
}

type QueueHandlerMap = Record<string, {instance: object, handler: HandlerFunction}>
type HandlerFunction<T = void> = () => Promise<T> 
