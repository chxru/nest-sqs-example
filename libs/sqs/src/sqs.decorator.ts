import { SetMetadata } from "@nestjs/common";

export const SQS_CONSUMER = Symbol.for("SQS_CONSUMER")

export type SqsConsumerParams = {
  name?: string;
  url?: string;
}
export const SqsConsumer = (params: SqsConsumerParams) => SetMetadata(SQS_CONSUMER, params)
